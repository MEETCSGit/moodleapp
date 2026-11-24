// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { CoreSites } from '@services/sites';
import { CorePath } from '@static/path';
import { NativeHttp } from '@singletons';

/**
 * IRClass: get a view-only PDF for the app's own viewer, kept in memory only.
 *
 * The site refuses view-only PDFs on the routes the app normally uses (web service and token), but serves them inline on
 * the website file route to a logged-in user, for its own viewer. The app does the same with the native HTTP plugin:
 * it logs that client in with a one-time key (autologin) and asks for the file the way the website viewer does
 * (Sec-Fetch-Dest: empty). Nothing is written to the device.
 *
 * The native client keeps its website login. The key is limited by the site (one every few minutes per account), so
 * without a key the existing login is used only when it was made by the same app account; otherwise it is cleared and
 * the request fails (the caller then offers the website viewer), so a PDF is never fetched as another account.
 */

/**
 * The site gave no login key (it allows one per account every few minutes) and the client has no login of this account.
 */
export class CoreIrclassPdfNoLoginError extends Error {}

/** Site and user the native client is logged in as (from a key login), or undefined when unknown. */
let nativeLogin: { siteId: string; userId: number } | undefined;

/**
 * Get a view-only PDF of the current site.
 *
 * @param pdfUrl Website file address (pluginfile.php/...).
 * @returns PDF data.
 */
export async function coreIrclassFetchViewOnlyPdf(pdfUrl: string): Promise<Uint8Array> {
    const site = CoreSites.getRequiredCurrentSite();
    const homeUrl = CorePath.concatenatePaths(site.getURL(), 'index.php');
    const autoLoginUrl = await site.getAutoLoginUrl(homeUrl, false);
    const sameAccount = nativeLogin?.siteId === site.getId() && nativeLogin.userId === site.getUserId();

    if (autoLoginUrl !== homeUrl) {
        // Start from a clean client so the key is not refused as "already logged in as someone else".
        NativeHttp.clearCookies();
        nativeLogin = undefined;

        // The site logs the client in on the autologin page and sets the login cookie on its redirect answer. The plugin
        // only keeps cookies of the answer it returns, so the redirect must not be followed or the cookie is lost. The
        // plugin ignores a per-request "false", so it is switched off globally just for this request.
        const followRedirect = NativeHttp.getFollowRedirect();
        NativeHttp.setFollowRedirect(false);
        try {
            await NativeHttp.sendRequest(autoLoginUrl, { method: 'get', responseType: 'text' });
        } catch (error) {
            // A redirect (3xx) is the expected answer: the login cookie was stored.
            const status = Number((error as { status?: number })?.status);
            if (!(status >= 300 && status < 400)) {
                throw error;
            }
        } finally {
            NativeHttp.setFollowRedirect(followRedirect);
        }

        nativeLogin = { siteId: site.getId(), userId: site.getUserId() };
    } else if (!sameAccount) {
        // No key and the client login may belong to another account: never use it.
        NativeHttp.clearCookies();
        nativeLogin = undefined;

        throw new CoreIrclassPdfNoLoginError('No login key available yet');
    }

    const response = await NativeHttp.sendRequest(pdfUrl, {
        method: 'get',
        responseType: 'arraybuffer',
        headers: {
            // Same as the website viewer's request: the site serves the file inline, not as a page or a download.
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Accept': 'application/pdf,*/*', // eslint-disable-line @typescript-eslint/naming-convention
        },
    });

    const data = new Uint8Array(response.data as ArrayBuffer);
    // A PDF starts with "%PDF". Anything else (login page, error) is not usable.
    if (response.status < 200 || response.status >= 300 || data.length < 5 ||
        String.fromCharCode(data[0], data[1], data[2], data[3]) !== '%PDF') {
        nativeLogin = undefined;

        throw new Error(`The site did not send the PDF (HTTP ${response.status})`);
    }

    return data;
}

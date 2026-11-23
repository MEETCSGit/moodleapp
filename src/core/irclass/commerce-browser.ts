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
import { CoreEvents } from '@static/events';
import { CoreOpener } from '@static/opener';
import { CoreUrl } from '@static/url';
import { InAppBrowserObject, InAppBrowserOptions } from '@awesome-cordova-plugins/in-app-browser/ngx';

/**
 * IRClass: open the website buying pages (checkout, enrolment, order) in the in-app browser, never logged in as another
 * account, and without asking the learner to log in again when buying twice in a row.
 *
 * The in-app browser keeps its website login between visits, also after switching account in the app. The app logs it in
 * with a one-time key, but the site gives at most one key per account every few minutes (autologinmintimebetweenreq).
 *
 * - Key given: open with a cleared session and the key, so the browser is logged in as the app account.
 * - No key, and the browser was last logged in (with a key) by this same app account: keep that login (buying a second
 *   course right after the first one).
 * - No key, and the browser login is from another account or unknown: open with a cleared session, so the website login
 *   page shows instead of another account.
 *
 * Who is logged in is remembered only while the app runs (after a restart it is unknown, so the safe path is used). It is
 * updated by every key login in the in-app browser, also from other parts of the app, and forgotten when the website
 * login or logout page loads there (someone may have logged in as another user by hand).
 */

/** Site and user the in-app browser is logged in as (from a key login), or undefined when unknown. */
let browserLogin: { siteId: string; userId: number } | undefined;

CoreEvents.on(CoreEvents.IAB_LOAD_START, (event) => {
    const url = event.url || '';
    if (url.includes('/admin/tool/mobile/autologin.php')) {
        const site = CoreSites.getCurrentSite();
        const userId = Number(CoreUrl.extractUrlParams(url).userid);
        browserLogin = site && userId && site.containsUrl(url) ? { siteId: site.getId(), userId } : undefined;
    } else if (/\/login\/(index|logout)\.php/.test(url)) {
        browserLogin = undefined;
    }
});

/**
 * Open a website page in the in-app browser, logged in as the app account (see above). Used for the buying pages and the
 * view-only PDF viewer.
 *
 * @param url Website page.
 * @param options Extra in-app browser display options (for example to hide the address bar).
 * @returns In-app browser.
 */
export async function coreIrclassOpenCommercePage(url: string, options: InAppBrowserOptions = {}): Promise<InAppBrowserObject> {
    const site = CoreSites.getRequiredCurrentSite();
    const autoLoginUrl = await site.getAutoLoginUrl(url);
    const hasKey = autoLoginUrl !== url;
    const sameAccount = browserLogin?.siteId === site.getId() && browserLogin.userId === site.getUserId();

    if (hasKey) {
        // The key login is recorded by the load listener above.
        browserLogin = undefined;
    }

    return CoreOpener.openInApp(autoLoginUrl, {
        ...options,
        originalUrl: url,
        clearsessioncache: hasKey || !sameAccount ? 'yes' : 'no',
    });
}

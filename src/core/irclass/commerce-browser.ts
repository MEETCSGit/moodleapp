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
import { InAppBrowserObject } from '@awesome-cordova-plugins/in-app-browser/ngx';

/**
 * IRClass: open a buying page of the website (checkout, enrolment, order) in the in-app browser, always with a clean
 * website session.
 *
 * The in-app browser keeps its website login between visits, also after switching account in the app. The app logs in
 * with a one-time key, but the site gives at most one key per account every few minutes (autologinmintimebetweenreq);
 * without a key the page would open with the previous login, so a learner could buy on another account. Clearing the
 * session first means the page opens logged in as the app account (key given) or on the website login page (no key),
 * never as someone else.
 *
 * @param url Website page.
 * @returns In-app browser.
 */
export async function coreIrclassOpenCommercePage(url: string): Promise<InAppBrowserObject> {
    return CoreSites.getRequiredCurrentSite().openInAppWithAutoLogin(url, { clearsessioncache: 'yes' });
}

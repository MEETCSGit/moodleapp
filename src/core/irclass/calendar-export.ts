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

import { CoreFile } from '@services/file';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreLoadings } from '@services/overlays/loadings';
import { CorePlatform } from '@services/platform';
import { CoreSites } from '@services/sites';
import { CoreWS } from '@services/ws';
import { CoreOpener } from '@static/opener';
import { CorePath } from '@static/path';
import { CoreUrl } from '@static/url';
import { ActionSheetController, Translate, WebIntent } from '@singletons';
import { coreIrclassSaveToAndroidDownloads } from './pdf-download';

/**
 * IRClass: "Add to my calendar" on the app Calendar page.
 *
 * Uses Moodle's personal calendar export (Calendar > Export calendar on the website): the same events the learner sees in the
 * app calendar (own, course, group and site events), from a few days ago to the site look-ahead. The address carries the
 * learner's private calendar key (core_calendar_get_calendar_export_token), so it is never shown or copied, only handed to
 * the phone calendar.
 *
 * - Subscribe: iOS opens the webcal:// address in Apple Calendar ("Subscribe to calendar?"). Android offers it to the
 *   calendar apps that can subscribe (Android lists them when there are several); when none can, it opens the Google
 *   Calendar "add calendar from URL" page with the address filled in.
 * - Download (.ics): a one-time copy. Android saves it in Download and "View" lists the apps that can import it. iOS opens
 *   it in the system preview, with "Add All" and the Share button for other apps.
 */

const WS_EXPORT_TOKEN = 'core_calendar_get_calendar_export_token';
const GOOGLE_SUBSCRIBE_URL = 'https://calendar.google.com/calendar/r';

/**
 * Whether the site offers the calendar export to the app.
 *
 * @returns Whether it does.
 */
export function coreIrclassCalendarExportAvailable(): boolean {
    return !!CoreSites.getCurrentSite()?.wsAvailable(WS_EXPORT_TOKEN);
}

/**
 * Show the "Add to my calendar" choices.
 */
export async function coreIrclassShowAddToCalendar(): Promise<void> {
    const sheet = await ActionSheetController.create({
        header: Translate.instant('addon.calendar.irclassaddtomycalendar'),
        subHeader: Translate.instant('addon.calendar.irclassaddtomycalendarnote'),
        buttons: [
            {
                text: Translate.instant('addon.calendar.irclasssubscribe'),
                handler: (): void => {
                    subscribe();
                },
            },
            {
                text: Translate.instant('addon.calendar.irclassdownloadics'),
                handler: (): void => {
                    download();
                },
            },
            {
                text: Translate.instant('core.cancel'),
                role: 'cancel',
            },
        ],
    });

    await sheet.present();
}

/**
 * Get the learner's personal calendar export address. Asks the site each time, so a changed key (after a password
 * change) is picked up.
 *
 * @returns Address (https).
 */
async function getExportUrl(): Promise<string> {
    const site = CoreSites.getRequiredCurrentSite();
    const result = await site.read<{ token: string }>(WS_EXPORT_TOKEN, {}, { getFromCache: false, saveToCache: false });

    return CoreUrl.addParamsToUrl(CorePath.concatenatePaths(site.getURL(), 'calendar/export_execute.php'), {
        userid: site.getUserId(),
        authtoken: result.token,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        preset_what: 'all',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        preset_time: 'recentupcoming',
    });
}

/**
 * Get the export address, with a loading indicator and the error shown.
 *
 * @returns Address, or undefined on error.
 */
async function getExportUrlWithLoading(): Promise<string | undefined> {
    const modal = await CoreLoadings.show();
    try {
        return await getExportUrl();
    } catch (error) {
        CoreAlerts.showError(error, { default: Translate.instant('addon.calendar.irclassexporterror') });
    } finally {
        modal.dismiss();
    }
}

/**
 * Subscribe the phone calendar to the learner's calendar.
 */
async function subscribe(): Promise<void> {
    const url = await getExportUrlWithLoading();
    if (!url) {
        return;
    }
    const webcalUrl = url.replace(/^https?:\/\//i, 'webcal://');

    if (CorePlatform.isAndroid()) {
        try {
            // Any calendar app that can subscribe (Android shows a chooser when there are several).
            await WebIntent.startActivity({ action: WebIntent.ACTION_VIEW, url: webcalUrl });

            return;
        } catch {
            // No app on the phone can subscribe: use the Google Calendar website, which syncs to the phone.
        }

        await CoreOpener.openInBrowser(
            CoreUrl.addParamsToUrl(GOOGLE_SUBSCRIBE_URL, { cid: webcalUrl }),
            { showBrowserWarning: false },
        );

        return;
    }

    if (CorePlatform.isIOS()) {
        // Apple Calendar shows "Subscribe to calendar?".
        window.open(webcalUrl, '_system');

        return;
    }

    // Browser (development preview): nothing can subscribe, open the calendar file.
    window.open(url, '_blank');
}

/**
 * Download the learner's calendar as an .ics file (a one-time copy).
 */
async function download(): Promise<void> {
    const url = await getExportUrlWithLoading();
    if (!url) {
        return;
    }

    if (!CorePlatform.isMobile()) {
        // Browser (development preview): the site sends the file as a download.
        window.open(url, '_blank');

        return;
    }

    const now = new Date();
    const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
    const fileName = `irclass-calendar-${day}.ics`;
    let localPath: string;
    const modal = await CoreLoadings.show('core.downloading', true);
    try {
        const siteFolder = CoreFile.getSiteFolder(CoreSites.getRequiredCurrentSite().getId());
        const path = CorePath.concatenatePaths(siteFolder, `irclass/${fileName}`);
        const entry = await CoreWS.downloadFile(url, path);
        localPath = CoreFile.getFileEntryURL(entry);
        await checkIsCalendar(path);
    } catch (error) {
        CoreAlerts.showError(error, { default: Translate.instant('addon.calendar.irclassexporterror') });

        return;
    } finally {
        modal.dismiss();
    }

    if (CorePlatform.isIOS()) {
        // System preview: "Add All" adds the events to Apple Calendar, Share offers other apps.
        try {
            await CoreOpener.openFile(localPath);
        } catch (error) {
            CoreAlerts.showError(error);
        }

        return;
    }

    await coreIrclassSaveToAndroidDownloads({
        localPath,
        fileName,
        mimeType: 'text/calendar',
        savedMessage: 'addon.calendar.irclasscalendarsaved',
        permissionMessage: 'addon.calendar.irclassstoragepermission',
    });
}

/**
 * Make sure the downloaded file is a calendar: when export is turned off or the key is wrong, the site answers with a short
 * text instead ("no export", "Invalid authentication").
 *
 * @param path Downloaded file, relative to the app storage.
 */
async function checkIsCalendar(path: string): Promise<void> {
    const content = await CoreFile.readFile(path);
    if (typeof content !== 'string' || !content.trimStart().startsWith('BEGIN:VCALENDAR')) {
        throw new Error(Translate.instant('addon.calendar.irclassexporterror'));
    }
}

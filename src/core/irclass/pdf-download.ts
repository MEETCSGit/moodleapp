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

import { CoreNative } from '@features/native/services/native';
import { CoreFile } from '@services/file';
import { CoreFileHelper } from '@services/file-helper';
import { CoreFilepool } from '@services/filepool';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreLoadings } from '@services/overlays/loadings';
import { CoreToasts } from '@services/overlays/toasts';
import { CorePlatform } from '@services/platform';
import { CoreSites } from '@services/sites';
import { CoreOpener } from '@static/opener';
import { Translate } from '@singletons';

/**
 * IRClass: download a PDF (certificate, invoice) and keep a copy where the learner can find it.
 *
 * - Android: saved in the public Download folder (no permission on Android 10+, asked once on 7 to 9); the saved message
 *   offers View to open it.
 * - iOS: opened in the system PDF preview, whose Share button offers "Save to Files" (Downloads or any folder). The
 *   native "Save to Files" picker showed a black screen on devices, so the proven preview is used instead.
 * - Browser (development preview): opened as before, there is no device Downloads.
 *
 * @param options Options.
 * @param options.fileUrl PDF address on the site (pluginfile).
 * @param options.fileName File name to save with.
 * @param options.component Component, to keep the downloaded file in the app storage.
 * @param options.componentId Component id.
 * @param options.timemodified Time modified, so a changed file is downloaded again.
 * @param options.savedMessage Translation key of the "saved" message, with {{$a}} for the file name.
 * @param options.permissionMessage Translation key of the message when Android 7 to 9 storage permission is refused.
 */
export async function coreIrclassDownloadPdf(options: {
    fileUrl: string;
    fileName: string;
    component: string;
    componentId: string | number;
    timemodified?: number;
    savedMessage: string;
    permissionMessage: string;
}): Promise<void> {
    if (!options.fileUrl) {
        return;
    }

    const plugin = CoreNative.plugin('downloads');
    if (!CorePlatform.isMobile() || !plugin) {
        // Development preview in a browser: open the file as before.
        try {
            await CoreFileHelper.downloadAndOpenFile(
                { fileurl: options.fileUrl, filename: options.fileName, mimetype: 'application/pdf',
                    timemodified: options.timemodified ?? 0 },
                options.component,
                options.componentId,
            );
        } catch (error) {
            CoreAlerts.showError(error);
        }

        return;
    }

    let localPath: string;
    const modal = await CoreLoadings.show();
    try {
        const url = await CoreFilepool.downloadUrl(
            CoreSites.getRequiredCurrentSite().getId(),
            options.fileUrl,
            false,
            options.component,
            options.componentId,
            options.timemodified ?? 0,
        );
        localPath = CoreFile.unconvertFileSrc(url);
    } catch (error) {
        CoreAlerts.showError(error);

        return;
    } finally {
        modal.dismiss();
    }

    if (CorePlatform.isIOS()) {
        try {
            await CoreOpener.openFile(localPath);
        } catch (error) {
            CoreAlerts.showError(error);
        }

        return;
    }

    await coreIrclassSaveToAndroidDownloads({
        localPath,
        fileName: options.fileName,
        mimeType: 'application/pdf',
        savedMessage: options.savedMessage,
        permissionMessage: options.permissionMessage,
    });
}

/**
 * IRClass: save a copy of a file already in the app storage to the Android Download folder, then show a one-line message
 * with "View" to open it (Android shows the apps that can open it). The file is not opened automatically.
 *
 * @param options Options.
 * @param options.localPath Path or file:// URL of the file in the app storage.
 * @param options.fileName File name to save with.
 * @param options.mimeType MIME type of the file.
 * @param options.savedMessage Translation key of the "saved" message, with {{$a}} for the file name.
 * @param options.permissionMessage Translation key of the message when Android 7 to 9 storage permission is refused.
 */
export async function coreIrclassSaveToAndroidDownloads(options: {
    localPath: string;
    fileName: string;
    mimeType: string;
    savedMessage: string;
    permissionMessage: string;
}): Promise<void> {
    const plugin = CoreNative.plugin('downloads');
    if (!plugin) {
        await CoreOpener.openFile(options.localPath);

        return;
    }

    try {
        const result = await plugin.saveToDownloads(options.localPath, options.fileName, options.mimeType);
        if (!result.saved) {
            return;
        }

        // The file is only saved, not opened. The message offers "View" to open it now, on the same line.
        CoreToasts.show({
            message: Translate.instant(options.savedMessage, { $a: result.name || options.fileName }),
            duration: 6000,
            cssClass: 'core-toast-inline',
            buttons: [{
                text: Translate.instant('core.view'),
                handler: (): void => {
                    CoreOpener.openFile(options.localPath).catch((error) => {
                        // No app to open it: the copy in Downloads is still there.
                        CoreAlerts.showError(error);
                    });
                },
            }],
        });
    } catch (error) {
        CoreAlerts.showError(error === 'permission_denied' ? Translate.instant(options.permissionMessage) : error);
    }
}

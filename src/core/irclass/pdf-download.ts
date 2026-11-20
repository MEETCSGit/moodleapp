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
 * - Android: saved in the public Download folder (no permission on Android 10+, asked once on 7 to 9), then opened.
 * - iOS: the system "Save to Files" screen, where the learner picks a folder such as Downloads.
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

    try {
        const result = await plugin.saveToDownloads(localPath, options.fileName, 'application/pdf');
        if (result.saved) {
            CoreToasts.show({
                message: Translate.instant(options.savedMessage, { $a: result.name || options.fileName }),
                duration: 4000,
            });
        }
    } catch (error) {
        CoreAlerts.showError(error === 'permission_denied' ? Translate.instant(options.permissionMessage) : error);
    }

    if (CorePlatform.isAndroid()) {
        // Show it too (on iOS the Save to Files screen is enough; the file can be opened from Files).
        try {
            await CoreOpener.openFile(localPath);
        } catch {
            // No PDF viewer: the copy in Downloads is still there.
        }
    }
}

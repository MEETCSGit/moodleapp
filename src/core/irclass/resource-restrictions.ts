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

import { Injectable } from '@angular/core';
import { CoreCacheUpdateFrequency } from '@/core/constants';
import { CoreSites } from '@services/sites';
import { CoreAlerts } from '@services/overlays/alerts';
import { CorePath } from '@static/path';
import { CoreUrl } from '@static/url';
import { makeSingleton, Translate } from '@singletons';
import { coreIrclassOpenCommercePage } from './commerce-browser';

const WS_GET_POLICY = 'local_irclass_resrestrict_get_effective_policy';
const ROOT_CACHE_KEY = 'CoreIrclassResRestrict:';

/** Activities whose files the site plugin can restrict (handled "file", "folder" and "embedded"). */
const RESTRICTABLE_MODULES = ['resource', 'folder', 'page', 'book'];

/**
 * IRClass resource restrictions (site plugin local_irclass_resrestrict).
 *
 * The site decides, file by file, whether a course file is "view only" or can be downloaded (site, category, course and
 * file settings, locks, file type list, plugin on or off) and refuses view-only files on the routes the app downloads
 * through. The app asks the site for the decision of an activity (local_irclass_resrestrict_get_effective_policy) and:
 * - opens a view-only PDF in the website PDF viewer (no download button) instead of downloading it;
 * - explains that a view-only file without viewer (for example Word) cannot be opened;
 * - does not offer offline download of activities with view-only files.
 * The site still enforces everything; this only lets the app behave sensibly.
 */
@Injectable({ providedIn: 'root' })
export class CoreIrclassResRestrictService {

    /**
     * Whether the site has the plugin's web service for the app.
     *
     * @returns Whether it does.
     */
    isAvailable(): boolean {
        return !!CoreSites.getCurrentSite()?.wsAvailable(WS_GET_POLICY);
    }

    /**
     * Whether an activity type can have restricted files.
     *
     * @param modName Activity type.
     * @returns Whether it can.
     */
    isRestrictableModule(modName: string): boolean {
        return RESTRICTABLE_MODULES.includes(modName);
    }

    /**
     * Get the decision of every file of an activity.
     *
     * @param cmid Course module id.
     * @param fresh Ask the site even if a recent answer is saved (when opening a file). The saved answer is used offline.
     * @returns Files with their decision, or undefined when the site does not say (no plugin, error).
     */
    async getModuleFiles(cmid: number, fresh = false): Promise<CoreIrclassResRestrictFile[] | undefined> {
        if (!this.isAvailable()) {
            return;
        }

        try {
            const site = CoreSites.getRequiredCurrentSite();
            const result = await site.read<{ files: CoreIrclassResRestrictFile[] }>(WS_GET_POLICY, { cmid }, {
                cacheKey: `${ROOT_CACHE_KEY}${cmid}`,
                updateFrequency: CoreCacheUpdateFrequency.OFTEN,
                getFromCache: !fresh,
                emergencyCache: true,
            });

            return result.files;
        } catch {
            return;
        }
    }

    /**
     * Whether an activity has a file that cannot be downloaded, so it must not be offered for offline download.
     *
     * @param modName Activity type.
     * @param cmid Course module id.
     * @returns Whether it has.
     */
    async hasViewOnlyFiles(modName: string, cmid: number): Promise<boolean> {
        if (!this.isRestrictableModule(modName)) {
            return false;
        }

        const files = await this.getModuleFiles(cmid);

        return !!files?.some((file) => !file.candownload);
    }

    /**
     * Get the decision of one file of an activity.
     *
     * @param cmid Course module id.
     * @param file File of the activity contents.
     * @param file.filepath Path inside the activity, for example "/".
     * @param file.filename File name.
     * @returns Decision, or undefined when the site does not say.
     */
    async getFileDecision(
        cmid: number,
        file: { filepath?: string; filename?: string },
    ): Promise<CoreIrclassResRestrictFile | undefined> {
        const files = await this.getModuleFiles(cmid, true);
        if (!files) {
            return;
        }
        const name = CorePath.concatenatePaths(file.filepath || '/', file.filename || '');

        return files.find((item) => item.filename === name) ?? (files.length === 1 ? files[0] : undefined);
    }

    /**
     * Handle a view-only file the way the website does, if it is one.
     * - PDF viewer: opens the website viewer in the in-app browser.
     * - No viewer: explains that it cannot be opened.
     * - Native (video, audio): not handled here, the app plays it as before (priority 2 will stop saving copies).
     *
     * @param cmid Course module id.
     * @param file File of the activity contents.
     * @param file.filepath Path inside the activity.
     * @param file.filename File name.
     * @param file.fileurl File address.
     * @returns "handled" when the viewer or the message was shown (the caller must not download the file), "play" for view-only
     *          video or audio (the caller plays it as before, never through the browser), undefined when not view-only.
     */
    async handleViewOnly(
        cmid: number,
        file: { filepath?: string; filename?: string; fileurl?: string },
    ): Promise<'handled' | 'play' | undefined> {
        const decision = await this.getFileDecision(cmid, file);
        if (!decision || decision.candownload) {
            return;
        }

        if (decision.viewer === 'native') {
            return 'play';
        }

        const viewerUrl = decision.viewer === 'pdfjs' && file.fileurl ? this.getViewerUrl(file.fileurl) : undefined;
        if (viewerUrl) {
            // Same login rules as the buying pages: never shown as another account.
            await coreIrclassOpenCommercePage(viewerUrl);

            return 'handled';
        }

        await CoreAlerts.show({
            header: Translate.instant('core.irclassviewonlytitle'),
            message: Translate.instant('core.irclassviewonlyunsupported'),
        });

        return 'handled';
    }

    /**
     * Whether a file is view-only and must not be shown from a local copy (embedded or in a frame): everything except
     * view-only video and audio, which the app plays as before.
     *
     * @param cmid Course module id.
     * @param file File of the activity contents.
     * @param file.filepath Path inside the activity.
     * @param file.filename File name.
     * @returns Whether it is.
     */
    async mustUseViewer(cmid: number, file: { filepath?: string; filename?: string }): Promise<boolean> {
        const decision = await this.getFileDecision(cmid, file);

        return !!decision && !decision.candownload && decision.viewer !== 'native';
    }

    /**
     * Get the website PDF viewer address of a file.
     *
     * @param fileUrl File address (pluginfile, webservice/pluginfile or tokenpluginfile).
     * @returns Viewer address, or undefined if the address is not a site file.
     */
    getViewerUrl(fileUrl: string): string | undefined {
        // tokenpluginfile.php/<token>/<contextid>/... or (webservice/)pluginfile.php/<contextid>/...
        const address = fileUrl.split('?')[0];
        const match = address.match(/\/tokenpluginfile\.php\/[^/]+(\/\d+\/.+)$/) ?? address.match(/\/pluginfile\.php(\/\d+\/.+)$/);
        if (!match) {
            return;
        }
        let path = match[1];
        try {
            path = decodeURIComponent(path);
        } catch {
            // Keep it encoded.
        }

        return CoreUrl.addParamsToUrl(
            CorePath.concatenatePaths(CoreSites.getRequiredCurrentSite().getURL(), 'local/irclass_resrestrict/viewer.php'),
            { path },
        );
    }

}

export const CoreIrclassResRestrict = makeSingleton(CoreIrclassResRestrictService);

/**
 * Decision of one file, from local_irclass_resrestrict_get_effective_policy.
 */
export type CoreIrclassResRestrictFile = {
    filename: string; // Path and name in the activity, for example "/notes.pdf".
    policy: 'viewonly' | 'download';
    viewer: 'pdfjs' | 'native' | 'none';
    candownload: boolean;
};

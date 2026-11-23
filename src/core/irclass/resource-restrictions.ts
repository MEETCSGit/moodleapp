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
import { CoreModals } from '@services/overlays/modals';
import { CorePlatform } from '@services/platform';
import { CoreMimetype } from '@static/mimetype';
import { CoreSites } from '@services/sites';
import { CoreAlerts } from '@services/overlays/alerts';
import { CorePath } from '@static/path';
import { CoreUrl } from '@static/url';
import { makeSingleton, Translate } from '@singletons';
import { coreIrclassOpenCommercePage } from './commerce-browser';

const WS_GET_POLICY = 'local_irclass_resrestrict_get_effective_policy';
const ROOT_CACHE_KEY = 'CoreIrclassResRestrict:';
const PDF_VIEWER_PATH = 'local/irclass_resrestrict/thirdparty/pdfjs/web/viewer.html';

/** Activities whose files the site plugin can restrict (handled "file", "folder" and "embedded"). */
const RESTRICTABLE_MODULES = ['resource', 'folder', 'page', 'book', 'label'];

/** Components that show activity content with embedded files, and their activity type. */
const EMBEDDING_COMPONENTS: Record<string, string> = {
    mmaModPage: 'page',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    AddonModPage: 'page',
    mmaModBook: 'book',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    AddonModBook: 'book',
    mmaModLabel: 'label',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    AddonModLabel: 'label',
};

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
     * Forget the saved decision of an activity, so the next check asks the site (course refreshed).
     *
     * @param modName Activity type.
     * @param cmid Course module id.
     */
    async invalidateModule(modName: string, cmid: number): Promise<void> {
        if (!this.isRestrictableModule(modName) || !this.isAvailable()) {
            return;
        }

        await CoreSites.getRequiredCurrentSite().invalidateWsCacheForKey(`${ROOT_CACHE_KEY}${cmid}`);
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
     * Get the names (path and name in the activity) of the view-only files of an activity.
     *
     * @param cmid Course module id.
     * @param fresh Ask the site even if a recent answer is saved.
     * @returns Names, empty when none or when the site does not say.
     */
    async getViewOnlyNames(cmid: number, fresh = false): Promise<Set<string>> {
        const files = await this.getModuleFiles(cmid, fresh);

        return new Set((files ?? []).filter((file) => !file.candownload).map((file) => file.filename));
    }

    /**
     * Key of a file of the activity contents, as the site names it ("/path/name").
     *
     * @param file File.
     * @param file.filepath Path inside the activity.
     * @param file.filename File name.
     * @returns Key.
     */
    fileKey(file: { filepath?: string; filename?: string }): string {
        return CorePath.concatenatePaths(file.filepath || '/', file.filename || '');
    }

    /**
     * Whether a file embedded in activity content (Page, Book, Label) is view-only video or audio, which must be streamed
     * and never saved on the device.
     *
     * @param component Component showing the content.
     * @param componentId Course module id.
     * @param url File address.
     * @returns Whether it is.
     */
    async isViewOnlyEmbeddedMedia(component: string | undefined, componentId: string | number | undefined, url: string):
    Promise<boolean> {
        const modName = component ? EMBEDDING_COMPONENTS[component] : undefined;
        const cmid = Number(componentId);
        if (!modName || !cmid || !this.getMediaKind(url)) {
            return false;
        }

        const names = await this.getViewOnlyNames(cmid);
        if (!names.size) {
            return false;
        }
        let path = this.getFilePath(url) ?? '';
        try {
            path = decodeURIComponent(path);
        } catch {
            // Keep it encoded.
        }

        return [...names].some((name) => path.endsWith(name));
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
     * Handle a view-only file the way the website does, if it is one. Nothing is saved on the device or given to another app.
     * - PDF viewer: the site's PDF viewer, full screen.
     * - Video and audio: the app's own player, streamed from the site.
     * - Other files shown natively (for example an image): the site's file route, full screen.
     * - No viewer: explains that it cannot be opened.
     *
     * @param cmid Course module id.
     * @param file File of the activity contents.
     * @param file.filepath Path inside the activity.
     * @param file.filename File name.
     * @param file.fileurl File address.
     * @returns "handled" when the file was a view-only file (shown or explained; the caller must not download or open it),
     *          undefined when it is not view-only.
     */
    async handleViewOnly(
        cmid: number,
        file: { filepath?: string; filename?: string; fileurl?: string },
    ): Promise<'handled' | undefined> {
        const decision = await this.getFileDecision(cmid, file);
        if (!decision || decision.candownload) {
            return;
        }

        const media = file.fileurl ? this.getMediaKind(file.filename || file.fileurl) : undefined;
        if (decision.viewer === 'native' && media && file.fileurl) {
            // The site streams view-only media to the app (its "Mobile app media" setting); the player never saves it.
            const url = await CoreSites.getRequiredCurrentSite().checkAndFixPluginfileURL(file.fileurl);
            // Loaded when needed: the player uses the shared module, which uses this service.
            const { CoreIrclassMediaPlayerComponent } = await import('./media-player/media-player');
            await CoreModals.openModal({
                component: CoreIrclassMediaPlayerComponent,
                componentProps: { title: file.filename || '', url, isAudio: media === 'audio' },
                cssClass: 'core-modal-fullscreen',
            });

            return 'handled';
        }

        const viewerUrl = decision.viewer === 'pdfjs' && file.fileurl
            ? this.getViewerUrl(file.fileurl)
            : (decision.viewer === 'native' && file.fileurl ? this.getWebFileUrl(file.fileurl) : undefined);
        if (viewerUrl) {
            // Only the file, full screen: no website around it, no address bar and no navigation buttons, just Close. Same
            // login rules as the buying pages, so never shown as another account. A real browser window (not a frame inside
            // an app screen) keeps the site login working on iOS and Android alike.
            await coreIrclassOpenCommercePage(viewerUrl, {
                location: CorePlatform.isIOS() ? 'no' : 'yes',
                hideurlbar: 'yes',
                hidenavigationbuttons: 'yes',
                closebuttoncaption: Translate.instant('core.close'),
            });

            return 'handled';
        }

        await CoreAlerts.show({
            header: Translate.instant('core.irclassviewonlytitle'),
            message: Translate.instant('core.irclassviewonlyunsupported'),
        });

        return 'handled';
    }

    /**
     * Whether a file is view-only, so it must never be shown from a downloaded or embedded copy, only with handleViewOnly.
     *
     * @param cmid Course module id.
     * @param file File of the activity contents.
     * @param file.filepath Path inside the activity.
     * @param file.filename File name.
     * @returns Whether it is.
     */
    async mustUseViewer(cmid: number, file: { filepath?: string; filename?: string }): Promise<boolean> {
        const decision = await this.getFileDecision(cmid, file);

        return !!decision && !decision.candownload;
    }

    /**
     * Whether a file is video or audio, from its name.
     *
     * @param name File name or address.
     * @returns "video", "audio" or undefined.
     */
    protected getMediaKind(name: string): 'video' | 'audio' | undefined {
        const extension = CoreMimetype.getFileExtension(name.split('?')[0]);
        const mimetype = extension ? CoreMimetype.getMimeType(extension) : undefined;
        if (mimetype?.startsWith('video/')) {
            return 'video';
        }
        if (mimetype?.startsWith('audio/')) {
            return 'audio';
        }
    }

    /**
     * Get the website address of a file (the route the site shows view-only files inline on, with the site session).
     *
     * @param fileUrl File address (pluginfile, webservice/pluginfile or tokenpluginfile).
     * @returns Website file address, or undefined if the address is not a site file.
     */
    protected getWebFileUrl(fileUrl: string): string | undefined {
        const path = this.getFilePath(fileUrl);

        return path ? CorePath.concatenatePaths(CoreSites.getRequiredCurrentSite().getURL(), `pluginfile.php${path}`) : undefined;
    }

    /**
     * Get the path of a site file after pluginfile.php (from the context id on).
     *
     * @param fileUrl File address (pluginfile, webservice/pluginfile or tokenpluginfile).
     * @returns Path, or undefined if the address is not a site file.
     */
    protected getFilePath(fileUrl: string): string | undefined {
        // tokenpluginfile.php/<token>/<contextid>/... or (webservice/)pluginfile.php/<contextid>/...
        const address = fileUrl.split('?')[0];
        const match = address.match(/\/tokenpluginfile\.php\/[^/]+(\/\d+\/.+)$/) ?? address.match(/\/pluginfile\.php(\/\d+\/.+)$/);

        return match?.[1];
    }

    /**
     * Get the address of the site's PDF viewer (PDF.js, without download, print or open buttons) showing a file. The viewer
     * reads the file through the website file route, which serves view-only PDFs to it inline.
     *
     * @param fileUrl File address (pluginfile, webservice/pluginfile or tokenpluginfile).
     * @returns Viewer address, or undefined if the address is not a site file.
     */
    getViewerUrl(fileUrl: string): string | undefined {
        // Website file route (the viewer is logged in with the site session), path as the site encodes it.
        const pdfUrl = this.getWebFileUrl(fileUrl);
        if (!pdfUrl) {
            return;
        }

        return CoreUrl.addParamsToUrl(
            CorePath.concatenatePaths(CoreSites.getRequiredCurrentSite().getURL(), PDF_VIEWER_PATH),
            { file: pdfUrl },
            { anchor: 'pagemode=none' }, // Open on the page, without the sidebar.
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

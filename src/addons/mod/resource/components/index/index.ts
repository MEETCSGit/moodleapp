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

import { DownloadStatus } from '@/core/constants';
import { Component, OnInit } from '@angular/core';
import { CoreError } from '@classes/errors/error';
import { CoreCourseModuleMainResourceComponent } from '@features/course/classes/main-resource-component';
import { CoreCourse } from '@features/course/services/course';
import { CoreCourseModulePrefetchDelegate } from '@features/course/services/module-prefetch-delegate';
import { CoreNetwork } from '@services/network';
import { CoreFileHelper } from '@services/file-helper';
import { CoreSites } from '@services/sites';
import { CoreMimetype } from '@static/mimetype';
import { CoreText } from '@static/text';
import { Translate } from '@singletons';
import {
    AddonModResource,
    AddonModResourceCustomData,
} from '../../services/resource';
import { AddonModResourceHelper } from '../../services/resource-helper';
import { CorePlatform } from '@services/platform';
import { ADDON_MOD_RESOURCE_COMPONENT_LEGACY } from '../../constants';
import { CorePromiseUtils } from '@static/promise-utils';
import { OpenFileAction } from '@static/opener';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreCourseModuleNavigationComponent } from '@features/course/components/module-navigation/module-navigation';
import { CoreCourseModuleInfoComponent } from '@features/course/components/module-info/module-info';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreIrclassResRestrict } from '@/core/irclass/resource-restrictions';

/**
 * Component that displays a resource.
 */
@Component({
    selector: 'addon-mod-resource-index',
    templateUrl: 'addon-mod-resource-index.html',
    styleUrl: 'index.scss',
    imports: [
        CoreSharedModule,
        CoreCourseModuleInfoComponent,
        CoreCourseModuleNavigationComponent,
    ],
})
export class AddonModResourceIndexComponent extends CoreCourseModuleMainResourceComponent implements OnInit {

    component = ADDON_MOD_RESOURCE_COMPONENT_LEGACY;
    pluginName = 'resource';

    mode = '';
    src = '';
    contentText = '';
    displayDescription = true;
    warning = '';
    isIOS = false;
    openFileAction = OpenFileAction;
    readonly isOnline = CoreNetwork.onlineSignal;
    isStreamedFile = false;
    shouldOpenInBrowser = false;
    viewOnly = false; // IRClass: view-only on the site (no "Open with", never saved).

    // Variables for 'external' mode.
    type = '';
    readableSize = '';
    timecreated = -1;
    timemodified = -1;
    isExternalFile = false;
    outdatedStatus = DownloadStatus.OUTDATED;

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        super.ngOnInit();

        this.isIOS = CorePlatform.isIOS();

        await this.loadContent();
    }

    /**
     * @inheritdoc
     */
    protected async invalidateContent(): Promise<void> {
        return AddonModResource.invalidateContent(this.module.id, this.courseId);
    }

    /**
     * @inheritdoc
     */
    protected async fetchContent(refresh?: boolean): Promise<void> {
        // Load module contents if needed. Passing refresh is needed to force reloading contents.
        const contents = await CoreCourse.getModuleContents(this.module, undefined, undefined, false, refresh);

        if (!contents.length) {
            throw new CoreError(Translate.instant('core.filenotfound'));
        }

        this.module.afterlink = await AddonModResourceHelper.getAfterLinkDetails(this.module, this.courseId);

        // Get the resource instance to get the latest name/description and to know if it's embedded.
        const resource = await AddonModResource.getResourceData(this.courseId, this.module.id);
        this.description = resource.intro || '';
        const options: AddonModResourceCustomData =
            resource.displayoptions ? CoreText.unserialize(resource.displayoptions) : {};

        this.displayDescription = options.printintro === undefined || !!options.printintro;
        this.dataRetrieved.emit(resource);

        this.setStatusListener();

        // IRClass: a view-only file (site plugin local_irclass_resrestrict) is never shown from a downloaded copy; the page
        // shows the Open button, which opens the website viewer or explains why it cannot be opened.
        const viewOnly = await CoreIrclassResRestrict.mustUseViewer(this.module.id, contents[0]);
        this.viewOnly = viewOnly;
        // The site was just asked: forget the saved "downloadable" state, which may come from an older decision.
        CoreCourseModulePrefetchDelegate.invalidateModuleStatusCache(this.module);
        if (viewOnly) {
            // A copy downloaded before the file became view-only is removed from the device.
            CorePromiseUtils.ignoreErrors(CoreCourseModulePrefetchDelegate.removeModuleFiles(this.module, this.courseId));
        }

        if (!viewOnly && AddonModResourceHelper.isDisplayedInIframe(this.module)) {

            const downloadResult = await this.downloadResourceIfNeeded(refresh, true);
            const src = await AddonModResourceHelper.getIframeSrc(this.module);
            this.mode = 'iframe';

            if (this.src && src.toString() == this.src.toString()) {
                // Re-loading same page.
                // Set it to empty and then re-set the src in the next digest so it detects it has changed.
                this.src = '';
                setTimeout(() => {
                    this.src = src;
                });
            } else {
                this.src = src;
            }

            // Never show description on iframe.
            this.displayDescription = false;

            this.warning = downloadResult.failed
                ? this.getErrorDownloadingSomeFilesMessage(downloadResult.error ?? '')
                : '';

            return;
        }

        if (
            !viewOnly && resource && 'display' in resource &&
            AddonModResourceHelper.isDisplayedEmbedded(this.module, resource.display)
        ) {
            this.mode = 'embedded';
            this.warning = '';

            this.contentText = await AddonModResourceHelper.getEmbeddedHtml(this.module);
            this.mode = this.contentText.length > 0 ? 'embedded' : 'external';
        } else {
            this.mode = 'external';
            this.warning = '';
            let mimetype: string;

            // Always show description on external.
            this.displayDescription = true;

            if (this.isIOS) {
                this.shouldOpenInBrowser = CoreFileHelper.shouldOpenInBrowser(contents[0]);
            }

            if ('contentsinfo' in this.module && this.module.contentsinfo) {
                mimetype = this.module.contentsinfo.mimetypes[0];
                this.readableSize = CoreText.bytesToSize(this.module.contentsinfo.filessize, 1);
                this.timemodified = this.module.contentsinfo.lastmodified * 1000;
            } else {
                mimetype = await CoreMimetype.getMimeTypeFromUrl(CoreFileHelper.getFileUrl(contents[0]));
                this.readableSize = CoreText.bytesToSize(contents[0].filesize, 1);
                this.timemodified = contents[0].timemodified * 1000;
            }

            this.timecreated = contents[0].timecreated * 1000;
            this.isExternalFile = !!contents[0].isexternalfile;
            this.type = CoreMimetype.getMimetypeDescription(mimetype);
            this.isStreamedFile = CoreMimetype.isStreamedMimetype(mimetype);
        }
    }

    /**
     * @inheritdoc
     */
    protected async logActivity(): Promise<void> {
        await CorePromiseUtils.ignoreErrors(AddonModResource.logView(this.module.instance));

        this.analyticsLogEvent('mod_resource_view_resource');
    }

    /**
     * Opens a file.
     *
     * @param iOSOpenFileAction Action to do in iOS.
     */
    async open(iOSOpenFileAction?: OpenFileAction): Promise<void> {
        // IRClass: a view-only file is not downloadable, but must not go to the browser either: the helper opens the website
        // viewer, explains that it cannot be opened, or plays view-only video and audio as before.
        const decision = this.module.contents?.[0]
            ? await CoreIrclassResRestrict.getFileDecision(this.module.id, this.module.contents[0])
            : undefined;
        if (decision && !decision.candownload) {
            await AddonModResourceHelper.openModuleFile(this.module, this.courseId, { iOSOpenFileAction });

            return;
        }

        if (decision) {
            // IRClass: the site just said the file can be downloaded; forget a saved "not downloadable" from an older
            // view-only decision, so it is not sent to the browser.
            CoreCourseModulePrefetchDelegate.invalidateModuleStatusCache(this.module);
        }

        let downloadable = await CoreCourseModulePrefetchDelegate.isModuleDownloadable(this.module, this.courseId);

        if (downloadable) {
            // Check if the main file is downloadle.
            // This isn't done in "isDownloadable" to prevent extra WS calls in the course page.
            downloadable = await AddonModResourceHelper.isMainFileDownloadable(this.module);

            if (downloadable) {
                if (this.currentStatus === DownloadStatus.OUTDATED && !this.isOnline() && !this.isExternalFile) {
                    // Warn the user that the file isn't updated.
                    const alert = await CoreAlerts.show({
                        message: Translate.instant('addon.mod_resource.resourcestatusoutdatedconfirm'),
                    });

                    await alert.onWillDismiss();
                }

                await AddonModResourceHelper.openModuleFile(this.module, this.courseId, { iOSOpenFileAction });

                return;
            }
        }

        // The resource cannot be downloaded, open the activity in browser.
        await CoreSites.getRequiredCurrentSite().openInBrowserWithAutoLogin(this.module.url ?? '');
    }

}

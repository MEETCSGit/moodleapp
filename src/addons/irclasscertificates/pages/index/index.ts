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

import { Component, OnInit } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreMainMenuUserButtonComponent } from '@features/mainmenu/components/user-menu-button/user-menu-button';
import { CoreNavigator } from '@services/navigator';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreFileHelper } from '@services/file-helper';
import { CoreText } from '@static/text';
import { ADDON_IRCLASS_CATALOG_PAGE_NAME } from '@addons/irclasscatalog/constants';
import { ADDON_IRCLASS_CERTIFICATES_COMPONENT_NAME } from '../../constants';
import { AddonIrclassCertificate, AddonIrclassCertificates } from '../../services/irclasscertificates';

/**
 * My certificates: the learner's certificates, as on the website My certificates page, with the PDF and the share link.
 */
@Component({
    selector: 'page-addon-irclasscertificates-index',
    templateUrl: 'index.html',
    styleUrl: 'index.scss',
    imports: [
        CoreSharedModule,
        CoreMainMenuUserButtonComponent,
    ],
})
export default class AddonIrclassCertificatesIndexPage implements OnInit {

    certificates: AddonIrclassCertificate[] = [];
    loaded = false;

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.fetch();
    }

    /**
     * Load the certificates.
     */
    async fetch(): Promise<void> {
        try {
            this.certificates = await AddonIrclassCertificates.getMyCertificates();
        } catch (error) {
            CoreAlerts.showError(error);
        }
        this.loaded = true;
    }

    /**
     * Pull to refresh.
     *
     * @param refresher Refresher.
     */
    async refresh(refresher?: HTMLIonRefresherElement): Promise<void> {
        await this.fetch();
        refresher?.complete();
    }

    /**
     * Download the certificate PDF with the app's login and open it in the device PDF viewer.
     *
     * @param certificate Certificate.
     */
    async download(certificate: AddonIrclassCertificate): Promise<void> {
        if (!certificate.downloadurl) {
            return;
        }

        try {
            await CoreFileHelper.downloadAndOpenFile(
                {
                    fileurl: certificate.downloadurl,
                    filename: certificate.filename || `${certificate.certificatenumber}.pdf`,
                    mimetype: 'application/pdf',
                    timemodified: certificate.timeissued,
                },
                ADDON_IRCLASS_CERTIFICATES_COMPONENT_NAME,
                certificate.id,
            );
        } catch (error) {
            CoreAlerts.showError(error);
        }
    }

    /**
     * Copy the public verify link, as "Copy share link" on the website.
     *
     * @param certificate Certificate.
     */
    async copyShareLink(certificate: AddonIrclassCertificate): Promise<void> {
        await CoreText.copyToClipboard(certificate.shareurl);
    }

    /**
     * Go to the course catalogue.
     */
    browseCourses(): void {
        CoreNavigator.navigateToSitePath(ADDON_IRCLASS_CATALOG_PAGE_NAME);
    }

}

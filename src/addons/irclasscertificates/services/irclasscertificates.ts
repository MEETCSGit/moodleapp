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
import { makeSingleton } from '@singletons';
import { ADDON_IRCLASS_CERTIFICATES_COMPONENT_NAME, ADDON_IRCLASS_CERTIFICATES_WS } from '../constants';

/**
 * IRClass My certificates. Data comes from the site plugin local_irclass_certificate, built with the same code as the
 * website My certificates page: only certificates that count (valid or imported), with the PDF and the share link.
 */
@Injectable({ providedIn: 'root' })
export class AddonIrclassCertificatesProvider {

    /**
     * Whether the site offers My certificates to the app.
     *
     * @param siteId Site ID. Current site if not defined.
     * @returns Whether it is available.
     */
    async isAvailable(siteId?: string): Promise<boolean> {
        const site = await CoreSites.getSite(siteId);

        return site.wsAvailable(ADDON_IRCLASS_CERTIFICATES_WS);
    }

    /**
     * Get the learner's certificates, newest first. Always asks the site when online (a certificate may have been
     * issued or revoked); the saved answer is used offline.
     *
     * @param siteId Site ID. Current site if not defined.
     * @returns Certificates.
     */
    async getMyCertificates(siteId?: string): Promise<AddonIrclassCertificate[]> {
        const site = await CoreSites.getSite(siteId);
        const result = await site.read<{ certificates: AddonIrclassCertificate[] }>(ADDON_IRCLASS_CERTIFICATES_WS, {}, {
            cacheKey: 'AddonIrclassCertificates:list',
            updateFrequency: CoreCacheUpdateFrequency.SOMETIMES,
            component: ADDON_IRCLASS_CERTIFICATES_COMPONENT_NAME,
            getFromCache: false,
            emergencyCache: true,
        });

        return result.certificates;
    }

}

export const AddonIrclassCertificates = makeSingleton(AddonIrclassCertificatesProvider);

/**
 * One certificate (local_irclass_certificate_get_my_certificates).
 */
export type AddonIrclassCertificate = {
    id: number;
    courseid: number;
    coursename: string;
    certificatenumber: string;
    timeissued: number;
    issuedate: string;
    status: 'valid' | 'imported';
    downloadurl: string; // Certificate PDF, empty when there is no file.
    filename: string;
    shareurl: string; // Public verify page.
};

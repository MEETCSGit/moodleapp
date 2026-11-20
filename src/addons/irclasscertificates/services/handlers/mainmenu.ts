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
import { CoreMainMenuHandler, CoreMainMenuPageNavHandlerData } from '@features/mainmenu/services/mainmenu-delegate';
import { makeSingleton } from '@singletons';
import { AddonIrclassCertificates } from '../irclasscertificates';
import { ADDON_IRCLASS_CERTIFICATES_COMPONENT_NAME, ADDON_IRCLASS_CERTIFICATES_PAGE_NAME } from '../../constants';

/**
 * Adds "My certificates" to the More menu, when the site offers the certificates service.
 */
@Injectable({ providedIn: 'root' })
export class AddonIrclassCertificatesMainMenuHandlerService implements CoreMainMenuHandler {

    name = ADDON_IRCLASS_CERTIFICATES_COMPONENT_NAME;
    priority = 460;

    /**
     * @inheritdoc
     */
    async isEnabled(): Promise<boolean> {
        return AddonIrclassCertificates.isAvailable();
    }

    /**
     * @inheritdoc
     */
    getDisplayData(): CoreMainMenuPageNavHandlerData {
        return {
            icon: 'fas-award',
            title: 'addon.irclasscertificates.mycertificates',
            page: ADDON_IRCLASS_CERTIFICATES_PAGE_NAME,
            class: 'addon-irclasscertificates-handler',
            onlyInMore: true,
        };
    }

}

export const AddonIrclassCertificatesMainMenuHandler = makeSingleton(AddonIrclassCertificatesMainMenuHandlerService);

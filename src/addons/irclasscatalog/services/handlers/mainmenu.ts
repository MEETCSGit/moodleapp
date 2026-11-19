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
import { AddonIrclassCatalog } from '../irclasscatalog';
import { ADDON_IRCLASS_CATALOG_COMPONENT_NAME, ADDON_IRCLASS_CATALOG_PAGE_NAME } from '../../constants';

/**
 * Adds the "Courses" tab (course catalogue) to the main menu, after Home. Only when the site offers the catalogue service.
 */
@Injectable({ providedIn: 'root' })
export class AddonIrclassCatalogMainMenuHandlerService implements CoreMainMenuHandler {

    name = ADDON_IRCLASS_CATALOG_COMPONENT_NAME;
    priority = 950;

    /**
     * @inheritdoc
     */
    async isEnabled(): Promise<boolean> {
        return AddonIrclassCatalog.isAvailable();
    }

    /**
     * @inheritdoc
     */
    getDisplayData(): CoreMainMenuPageNavHandlerData {
        return {
            icon: 'fas-graduation-cap',
            title: 'addon.irclasscatalog.courses',
            page: ADDON_IRCLASS_CATALOG_PAGE_NAME,
            class: 'addon-irclasscatalog-handler',
        };
    }

}

export const AddonIrclassCatalogMainMenuHandler = makeSingleton(AddonIrclassCatalogMainMenuHandlerService);

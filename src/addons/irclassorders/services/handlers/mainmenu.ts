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
import { AddonIrclassOrders } from '../irclassorders';
import { ADDON_IRCLASS_ORDERS_COMPONENT_NAME, ADDON_IRCLASS_ORDERS_PAGE_NAME } from '../../constants';

/**
 * Adds "My orders" to the More menu, when the site offers the order services.
 */
@Injectable({ providedIn: 'root' })
export class AddonIrclassOrdersMainMenuHandlerService implements CoreMainMenuHandler {

    name = ADDON_IRCLASS_ORDERS_COMPONENT_NAME;
    priority = 450;

    /**
     * @inheritdoc
     */
    async isEnabled(): Promise<boolean> {
        return AddonIrclassOrders.isAvailable();
    }

    /**
     * @inheritdoc
     */
    getDisplayData(): CoreMainMenuPageNavHandlerData {
        return {
            icon: 'fas-receipt',
            title: 'addon.irclassorders.myorders',
            page: ADDON_IRCLASS_ORDERS_PAGE_NAME,
            class: 'addon-irclassorders-handler',
            onlyInMore: true,
        };
    }

}

export const AddonIrclassOrdersMainMenuHandler = makeSingleton(AddonIrclassOrdersMainMenuHandlerService);

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
import { ADDON_IRCLASS_CATALOG_PAGE_NAME } from '@addons/irclasscatalog/constants';
import { AddonIrclassOrders, AddonIrclassOrderRow } from '../../services/irclassorders';
import { addonIrclassOrdersOpenInvoice, addonIrclassOrdersStatusColor } from '../../irclassorders-helper';

/**
 * My orders: the learner's paid orders and free enrolments, as on the website My orders page.
 */
@Component({
    selector: 'page-addon-irclassorders-index',
    templateUrl: 'index.html',
    styleUrl: '../../irclassorders.scss',
    imports: [
        CoreSharedModule,
        CoreMainMenuUserButtonComponent,
    ],
})
export default class AddonIrclassOrdersIndexPage implements OnInit {

    orders: AddonIrclassOrderRow[] = [];
    loaded = false;
    canLoadMore = false;
    loadMoreError = false;
    protected page = 0;
    protected total = 0;

    readonly statusColor = addonIrclassOrdersStatusColor;

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.fetch();
    }

    /**
     * Load the first page.
     */
    async fetch(): Promise<void> {
        try {
            const result = await AddonIrclassOrders.getMyOrders(0);
            this.page = 0;
            this.orders = result.orders;
            this.total = result.total;
            this.canLoadMore = this.orders.length < result.total;
        } catch (error) {
            CoreAlerts.showError(error);
        }
        this.loaded = true;
    }

    /**
     * Load the next page (infinite scroll).
     *
     * @param complete Infinite scroll complete function.
     */
    async loadMore(complete?: () => void): Promise<void> {
        try {
            const result = await AddonIrclassOrders.getMyOrders(this.page + 1);
            this.page = result.page;
            this.orders = this.orders.concat(result.orders);
            this.canLoadMore = result.orders.length > 0 && this.orders.length < result.total;
            this.loadMoreError = false;
        } catch (error) {
            this.loadMoreError = true;
            CoreAlerts.showError(error);
        } finally {
            complete?.();
        }
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
     * Open the order details.
     *
     * @param order Order row.
     */
    openOrder(order: AddonIrclassOrderRow): void {
        if (order.kind !== 'order' || !order.canview) {
            return;
        }
        CoreNavigator.navigate(`order/${order.reference}`);
    }

    /**
     * Download and open the invoice PDF.
     *
     * @param event Click event (the card is not opened).
     * @param order Order row.
     */
    async openInvoice(event: Event, order: AddonIrclassOrderRow): Promise<void> {
        event.stopPropagation();
        await addonIrclassOrdersOpenInvoice(order.invoiceurl, order.reference);
    }

    /**
     * Go to the course catalogue.
     */
    browseCourses(): void {
        CoreNavigator.navigateToSitePath(ADDON_IRCLASS_CATALOG_PAGE_NAME);
    }

}

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
import { CoreCourseHelper } from '@features/course/services/course-helper';
import { CoreNavigator } from '@services/navigator';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreSites } from '@services/sites';
import { CorePath } from '@static/path';
import { NgZone } from '@singletons';
import { AddonIrclassOrder, AddonIrclassOrders } from '../../services/irclassorders';
import { addonIrclassOrdersOpenInvoice } from '../../irclassorders-helper';

/**
 * Order details: the same state message, price summary (list price, coupon, GST lines, total), invoice and actions as the
 * website order page. Pay, Pay again and Buy again open the website order or checkout page in the in-app browser, because
 * payment always happens on the website.
 */
@Component({
    selector: 'page-addon-irclassorders-order',
    templateUrl: 'order.html',
    styleUrl: '../../irclassorders.scss',
    imports: [
        CoreSharedModule,
    ],
})
export default class AddonIrclassOrdersOrderPage implements OnInit {

    reference = '';
    order?: AddonIrclassOrder;
    loaded = false;

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.reference = CoreNavigator.getRequiredRouteParam<string>('reference');
        this.fetch();
    }

    /**
     * Alert card type for the order state.
     *
     * @returns Card type.
     */
    get stateType(): string {
        switch (this.order?.state) {
            case 'access':
            case 'notneeded':
                return 'success';
            case 'settingup':
            case 'checking':
                return 'info';
            case 'invalid':
                return 'danger';
            default:
                return 'warning';
        }
    }

    /**
     * Load the order.
     */
    async fetch(): Promise<void> {
        try {
            this.order = await AddonIrclassOrders.getOrder(this.reference);
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
     * Download and open the invoice PDF.
     */
    async openInvoice(): Promise<void> {
        if (this.order) {
            await addonIrclassOrdersOpenInvoice(this.order.invoiceurl, this.order.reference, this.order.invoicefilename);
        }
    }

    /**
     * Pay, Pay again or check the payment: the website order page in the in-app browser (it asks the bank again).
     */
    async openOrderPage(): Promise<void> {
        if (this.order) {
            await this.openOnWebsite(this.order.orderurl);
        }
    }

    /**
     * Buy again: the website checkout in the in-app browser.
     */
    async buyAgain(): Promise<void> {
        if (!this.order) {
            return;
        }
        const site = CoreSites.getRequiredCurrentSite();
        await this.openOnWebsite(
            CorePath.concatenatePaths(site.getURL(), `local/irclass_commerce/checkout.php?id=${this.order.courseid}`),
        );
    }

    /**
     * Open the course in the app.
     */
    openCourse(): void {
        if (this.order) {
            CoreCourseHelper.getAndOpenCourse(this.order.courseid, { isGuest: false });
        }
    }

    /**
     * Open a website page in the in-app browser, logged in, and refresh the order when the learner comes back.
     *
     * @param url Website page.
     */
    protected async openOnWebsite(url: string): Promise<void> {
        const browser = await CoreSites.getRequiredCurrentSite().openInAppWithAutoLogin(url);
        const exit = browser.on('exit').subscribe(() => {
            exit.unsubscribe();
            NgZone.run(() => {
                this.loaded = false;
                this.fetch();
            });
        });
    }

}

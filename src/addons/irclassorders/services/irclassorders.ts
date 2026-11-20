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
import { CoreSiteWSPreSets } from '@classes/sites/authenticated-site';
import { CoreSites } from '@services/sites';
import { makeSingleton } from '@singletons';
import {
    ADDON_IRCLASS_ORDERS_COMPONENT_NAME,
    ADDON_IRCLASS_ORDERS_LIST_WS,
    ADDON_IRCLASS_ORDERS_ORDER_WS,
} from '../constants';

/**
 * IRClass My orders. Data comes from the site plugin local_irclass_commerce, built with the same code as the website
 * My orders page and order page, so the app shows the same orders, statuses, prices and invoices.
 */
@Injectable({ providedIn: 'root' })
export class AddonIrclassOrdersProvider {

    protected static readonly ROOT_CACHE_KEY = 'AddonIrclassOrders:';

    /**
     * Whether the site offers My orders to the app.
     *
     * @param siteId Site ID. Current site if not defined.
     * @returns Whether it is available.
     */
    async isAvailable(siteId?: string): Promise<boolean> {
        const site = await CoreSites.getSite(siteId);

        return site.wsAvailable(ADDON_IRCLASS_ORDERS_LIST_WS) && site.wsAvailable(ADDON_IRCLASS_ORDERS_ORDER_WS);
    }

    /**
     * Get a page of the learner's orders, newest first.
     *
     * @param page Zero based page.
     * @param siteId Site ID. Current site if not defined.
     * @returns The orders.
     */
    async getMyOrders(page = 0, siteId?: string): Promise<AddonIrclassOrdersList> {
        const site = await CoreSites.getSite(siteId);

        return site.read<AddonIrclassOrdersList>(ADDON_IRCLASS_ORDERS_LIST_WS, { page }, this.preSets(`list:${page}`));
    }

    /**
     * Find a paid order of a course whose enrolment is still being set up: the same rule as the website course page
     * before it shows "Payment received. Your access is being set up." and "View your order" (paid, and the enrolment
     * step not finished; the order details state is then "settingup").
     *
     * @param courseId Course id.
     * @param siteId Site ID. Current site if not defined.
     * @returns Reference of that order, or undefined.
     */
    async getPaidOrderReference(courseId: number, siteId?: string): Promise<string | undefined> {
        if (!(await this.isAvailable(siteId))) {
            return;
        }

        // Orders are newest first; most learners have a single page.
        for (let page = 0; page < 20; page++) {
            const list = await this.getMyOrders(page, siteId);
            const paid = list.orders.filter((row) =>
                row.kind === 'order' && row.courseid === courseId && row.statuscode === 'paid');
            for (const row of paid) {
                const order = await this.getOrder(row.reference, siteId);
                if (order.state === 'settingup') {
                    return row.reference;
                }
            }
            if (!list.orders.length || (page + 1) * list.perpage >= list.total) {
                return;
            }
        }
    }

    /**
     * Get one of the learner's orders.
     *
     * @param reference Order reference.
     * @param siteId Site ID. Current site if not defined.
     * @returns The order.
     */
    async getOrder(reference: string, siteId?: string): Promise<AddonIrclassOrder> {
        const site = await CoreSites.getSite(siteId);

        return site.read<AddonIrclassOrder>(ADDON_IRCLASS_ORDERS_ORDER_WS, { reference }, this.preSets(`order:${reference}`));
    }

    /**
     * Always ask the site when online (order and payment status must be current); saved answers are used offline.
     *
     * @param key Cache key suffix.
     * @returns Pre sets.
     */
    protected preSets(key: string): CoreSiteWSPreSets {
        return {
            cacheKey: AddonIrclassOrdersProvider.ROOT_CACHE_KEY + key,
            updateFrequency: CoreCacheUpdateFrequency.SOMETIMES,
            component: ADDON_IRCLASS_ORDERS_COMPONENT_NAME,
            getFromCache: false,
            emergencyCache: true,
        };
    }

}

export const AddonIrclassOrders = makeSingleton(AddonIrclassOrdersProvider);

/**
 * Status of a row in My orders.
 */
export type AddonIrclassOrderStatusCode = 'paid' | 'checking' | 'failed' | 'expired' | 'awaiting' | 'free';

/**
 * One row of My orders (local_irclass_commerce_get_my_orders).
 */
export type AddonIrclassOrderRow = {
    kind: 'order' | 'free';
    reference: string;
    courseid: number;
    coursename: string;
    time: number;
    date: string;
    amount: string;
    statuscode: AddonIrclassOrderStatusCode;
    status: string;
    reason: string;
    invoiceurl: string;
    invoicepending: boolean;
    canview: boolean;
    canpayagain: boolean;
};

/**
 * Data returned by local_irclass_commerce_get_my_orders.
 */
export type AddonIrclassOrdersList = {
    total: number;
    page: number;
    perpage: number;
    orders: AddonIrclassOrderRow[];
};

/**
 * Data returned by local_irclass_commerce_get_order.
 */
export type AddonIrclassOrder = {
    reference: string;
    courseid: number;
    coursename: string;
    time: number;
    date: string;
    state: 'pay' | 'checking' | 'invalid' | 'settingup' | 'access' | 'notneeded' | 'payagain';
    message: string;
    summary: {
        listprice: string;
        hasdiscount: boolean;
        discountlabel: string;
        discount: string;
        lines: { label: string; amount: string }[];
        total: string;
        gstnote: string;
    };
    invoiceurl: string;
    invoicefilename: string;
    invoicepending: boolean;
    canpay: boolean;
    canpayagain: boolean;
    canrefresh: boolean;
    canopencourse: boolean;
    canstartagain: boolean;
    orderurl: string;
};

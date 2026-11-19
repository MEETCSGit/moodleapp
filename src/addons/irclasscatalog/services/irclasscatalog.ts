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
import { ADDON_IRCLASS_CATALOG_COMPONENT_NAME, ADDON_IRCLASS_CATALOG_WS } from '../constants';

/**
 * IRClass course catalogue. Data comes from the site plugin local_irclass_catalog (local_irclass_catalog_search_courses),
 * which uses the same search, filters, order and page size as the website page /local/irclass_catalog/index.php.
 */
@Injectable({ providedIn: 'root' })
export class AddonIrclassCatalogProvider {

    protected static readonly ROOT_CACHE_KEY = 'AddonIrclassCatalog:';

    /**
     * Whether the site offers the catalogue service to the app.
     *
     * @param siteId Site ID. Current site if not defined.
     * @returns Whether the service is available.
     */
    async isAvailable(siteId?: string): Promise<boolean> {
        const site = await CoreSites.getSite(siteId);

        return site.wsAvailable(ADDON_IRCLASS_CATALOG_WS);
    }

    /**
     * Search the catalogue.
     *
     * @param filters Keyword, filters and page.
     * @param options Options.
     * @param options.siteId Site ID. Current site if not defined.
     * @param options.refresh Whether to ignore cached data.
     * @returns Page of courses, total and the filter options.
     */
    async search(
        filters: AddonIrclassCatalogFilters,
        options: { siteId?: string; refresh?: boolean } = {},
    ): Promise<AddonIrclassCatalogSearchResult> {
        const site = await CoreSites.getSite(options.siteId);
        const params: AddonIrclassCatalogFilters = {
            q: filters.q.trim(),
            category: filters.category,
            price: filters.price,
            delivery: filters.delivery,
            page: filters.page,
        };
        const preSets: CoreSiteWSPreSets = {
            cacheKey: this.getSearchCacheKey(params),
            updateFrequency: CoreCacheUpdateFrequency.SOMETIMES,
            component: ADDON_IRCLASS_CATALOG_COMPONENT_NAME,
            getFromCache: !options.refresh,
        };

        return site.read<AddonIrclassCatalogSearchResult>(ADDON_IRCLASS_CATALOG_WS, params, preSets);
    }

    /**
     * Cache key of a search.
     *
     * @param params Search parameters.
     * @returns Cache key.
     */
    protected getSearchCacheKey(params: AddonIrclassCatalogFilters): string {
        return AddonIrclassCatalogProvider.ROOT_CACHE_KEY +
            [params.q, params.category, params.price, params.delivery, params.page].join(':');
    }

}

export const AddonIrclassCatalog = makeSingleton(AddonIrclassCatalogProvider);

/**
 * Search and filter values, as sent to the site.
 */
export type AddonIrclassCatalogFilters = {
    q: string; // Keyword, empty for all courses.
    category: number; // Top level category id, 0 for all.
    price: '' | 'free' | 'paid';
    delivery: number; // Delivery option id, 0 for all.
    page: number; // Zero based.
};

/**
 * One price of a paid course.
 */
export type AddonIrclassCatalogPrice = {
    currency: string;
    amount: string; // Formatted, with the currency symbol.
    gst: string; // GST label, empty when none.
};

/**
 * One course card.
 */
export type AddonIrclassCatalogCourse = {
    id: number;
    fullname: string;
    categoryname: string;
    summary: string; // First words of the summary, plain text.
    imageurl: string; // Empty when the course has no image.
    updated: string; // Last modified date, formatted by the site.
    students: number;
    enrolled: boolean;
    delivery: string;
    pricestate: '' | 'free' | 'paid';
    prices: AddonIrclassCatalogPrice[];
};

/**
 * Data returned by local_irclass_catalog_search_courses.
 */
export type AddonIrclassCatalogSearchResult = {
    total: number;
    page: number;
    perpage: number;
    courses: AddonIrclassCatalogCourse[];
    filters: {
        categories: { id: number; name: string }[];
        hasprices: boolean;
        deliveryoptions: { id: number; name: string }[];
    };
};

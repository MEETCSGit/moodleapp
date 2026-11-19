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
import { CoreCourseHelper } from '@features/course/services/course-helper';
import { CoreNavigator } from '@services/navigator';
import { CoreAlerts } from '@services/overlays/alerts';
import { Translate } from '@singletons';
import {
    AddonIrclassCatalog,
    AddonIrclassCatalogCourse,
    AddonIrclassCatalogFilters,
    AddonIrclassCatalogSearchResult,
} from '../../services/irclasscatalog';

/**
 * Course catalogue: the same courses, search, filters and card details as the website page /local/irclass_catalog/index.php.
 */
@Component({
    selector: 'page-addon-irclasscatalog-index',
    templateUrl: 'index.html',
    styleUrl: 'index.scss',
    imports: [
        CoreSharedModule,
        CoreMainMenuUserButtonComponent,
    ],
})
export default class AddonIrclassCatalogIndexPage implements OnInit {

    filters: AddonIrclassCatalogFilters = { q: '', category: 0, price: '', delivery: 0, page: 0 };
    options?: AddonIrclassCatalogSearchResult['filters'];
    courses: AddonIrclassCatalogCourse[] = [];
    total = 0;
    loaded = false;
    canLoadMore = false;
    loadMoreError = false;
    showFilters = false;

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        // Opened from the dashboard "Search available courses" with a keyword.
        this.filters.q = CoreNavigator.getRouteParam<string>('searchText')?.trim() ?? '';

        this.fetch();
    }

    /**
     * Number of active filters, shown on the Filters button.
     *
     * @returns Count.
     */
    get activeFilters(): number {
        return (this.filters.category ? 1 : 0) + (this.filters.price ? 1 : 0) + (this.filters.delivery ? 1 : 0);
    }

    /**
     * Load the first page for the current search and filters.
     *
     * @param refresh Whether to ignore cached data.
     */
    async fetch(refresh = false): Promise<void> {
        this.filters.page = 0;
        this.loadMoreError = false;

        try {
            const result = await AddonIrclassCatalog.search(this.filters, { refresh });
            this.options = result.filters;
            this.courses = result.courses;
            this.total = result.total;
            this.canLoadMore = this.courses.length < result.total;
        } catch (error) {
            CoreAlerts.showError(error, { default: Translate.instant('core.courses.errorloadcourses') });
            this.courses = [];
            this.total = 0;
            this.canLoadMore = false;
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
            const result = await AddonIrclassCatalog.search({ ...this.filters, page: this.filters.page + 1 });
            this.filters.page = result.page;
            this.courses = this.courses.concat(result.courses);
            this.total = result.total;
            this.canLoadMore = result.courses.length > 0 && this.courses.length < result.total;
        } catch (error) {
            this.loadMoreError = true;
            CoreAlerts.showError(error, { default: Translate.instant('core.courses.errorloadcourses') });
        } finally {
            complete?.();
        }
    }

    /**
     * Search by keyword.
     *
     * @param text Keyword.
     */
    async search(text: string): Promise<void> {
        this.filters.q = text;
        this.loaded = false;
        await this.fetch();
    }

    /**
     * A filter changed: close the filter panel (the active filters show as chips) and search again.
     */
    async filterChanged(): Promise<void> {
        this.showFilters = false;
        this.loaded = false;
        await this.fetch();
    }

    /**
     * Active filters, shown as chips that can be removed one by one.
     *
     * @returns Label and key of each active filter.
     */
    get activeFilterChips(): { key: 'category' | 'price' | 'delivery'; label: string }[] {
        const chips: { key: 'category' | 'price' | 'delivery'; label: string }[] = [];
        if (this.filters.category) {
            const name = this.options?.categories.find((category) => category.id === this.filters.category)?.name;
            chips.push({ key: 'category', label: name ?? Translate.instant('addon.irclasscatalog.category') });
        }
        if (this.filters.price) {
            chips.push({ key: 'price', label: Translate.instant(`addon.irclasscatalog.price${this.filters.price}`) });
        }
        if (this.filters.delivery) {
            const name = this.options?.deliveryoptions.find((option) => option.id === this.filters.delivery)?.name;
            chips.push({ key: 'delivery', label: name ?? Translate.instant('addon.irclasscatalog.delivery') });
        }

        return chips;
    }

    /**
     * Remove one filter.
     *
     * @param key Filter to remove.
     */
    async removeFilter(key: 'category' | 'price' | 'delivery'): Promise<void> {
        if (key === 'price') {
            this.filters.price = '';
        } else {
            this.filters[key] = 0;
        }
        await this.filterChanged();
    }

    /**
     * Clear all filters ("Clear all" next to the filter chips). The keyword stays; it is cleared with the search box button.
     */
    async clearFilters(): Promise<void> {
        this.filters = { ...this.filters, category: 0, price: '', delivery: 0, page: 0 };
        this.showFilters = false;
        this.loaded = false;
        await this.fetch();
    }

    /**
     * Pull to refresh.
     *
     * @param refresher Refresher.
     */
    async refresh(refresher?: HTMLIonRefresherElement): Promise<void> {
        await this.fetch(true);
        refresher?.complete();
    }

    /**
     * Open a course, like the app's own course lists: the course itself when enrolled, otherwise the course summary page
     * with the enrolment options. The catalogue already knows the enrolment, so no extra lookup is needed.
     *
     * @param course Course.
     */
    openCourse(course: AddonIrclassCatalogCourse): void {
        if (course.enrolled) {
            CoreCourseHelper.getAndOpenCourse(course.id, { isGuest: false });

            return;
        }

        // The summary page shows this price above the enrol button.
        CoreNavigator.navigateToSitePath(`/course/${course.id}/summary`, {
            params: { irclassPrice: { state: course.pricestate, prices: course.prices } },
        });
    }

}

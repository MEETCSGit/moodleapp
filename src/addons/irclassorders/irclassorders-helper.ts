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

import { coreIrclassDownloadPdf } from '@/core/irclass/pdf-download';
import { ADDON_IRCLASS_ORDERS_COMPONENT_NAME } from './constants';
import { AddonIrclassOrderStatusCode } from './services/irclassorders';

/**
 * Ionic colour of a My orders status badge (the website uses the same meaning: paid green, failed red, and so on).
 *
 * @param status Status code.
 * @returns Ionic colour name.
 */
export function addonIrclassOrdersStatusColor(status: AddonIrclassOrderStatusCode): string {
    switch (status) {
        case 'paid':
            return 'success';
        case 'failed':
            return 'danger';
        case 'awaiting':
            return 'warning';
        case 'checking':
            return 'info';
        case 'expired':
            return 'medium';
        default:
            return 'primary';
    }
}

/**
 * Download the invoice PDF with the app's login and save a copy in the device Downloads
 * (Android: Download folder, with a View button; iOS: Save to Files).
 *
 * @param fileUrl Invoice PDF address (pluginfile).
 * @param reference Order reference, used to keep the downloaded file.
 * @param fileName File name, if known.
 */
export async function addonIrclassOrdersOpenInvoice(fileUrl: string, reference: string, fileName?: string): Promise<void> {
    await coreIrclassDownloadPdf({
        fileUrl,
        fileName: fileName || decodeURIComponent(fileUrl.split('?')[0].split('/').pop() || 'invoice.pdf'),
        component: ADDON_IRCLASS_ORDERS_COMPONENT_NAME,
        componentId: reference,
        savedMessage: 'addon.irclassorders.savedtodownloads',
        permissionMessage: 'addon.irclassorders.storagepermission',
    });
}

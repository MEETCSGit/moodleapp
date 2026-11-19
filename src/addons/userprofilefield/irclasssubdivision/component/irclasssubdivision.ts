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

import { Component } from '@angular/core';

import { CoreUserProfileField } from '@features/user/services/user';
import { CoreUserProfileFieldBaseComponent } from '@features/user/classes/base-profilefield-component';
import { CoreSharedModule } from '@/core/shared.module';

/**
 * Renders the IRClass "State or Province" profile field (display only).
 */
@Component({
    selector: 'addon-user-profile-field-irclass-subdivision',
    templateUrl: 'addon-user-profile-field-irclass-subdivision.html',
    imports: [
        CoreSharedModule,
    ],
})
export class AddonUserProfileFieldIrclassSubdivisionComponent extends CoreUserProfileFieldBaseComponent {

    /**
     * @inheritdoc
     */
    protected initForNonEdit(field: CoreUserProfileField): void {
        // Show the state name. Fall back to the stored code if the site sent no name (unknown or removed state).
        this.value = field.displayvalue || field.value;
        this.valueNotFiltered = true;
    }

}

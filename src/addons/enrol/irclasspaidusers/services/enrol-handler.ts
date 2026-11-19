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
import { CoreEnrolAction, CoreEnrolHandler } from '@features/enrol/services/enrol-delegate';
import { makeSingleton } from '@singletons';

/**
 * IRClass paid enrolment (site plugin enrol_irclasspaidusers, sold by local_irclass_commerce).
 *
 * Enrolment happens on the website: the course enrolment page shows the price and Buy (or Enrol for free), then checkout,
 * the registration form when the course needs it, payment and fulfilment. The course summary page opens that page
 * (see CoreCourseSummaryPage.browserEnrol) and refreshes the course when the learner comes back.
 */
@Injectable({ providedIn: 'root' })
export class AddonEnrolIrclassPaidUsersHandlerService implements CoreEnrolHandler {

    name = 'AddonEnrolIrclassPaidUsers';
    type = 'irclasspaidusers';
    enrolmentAction = CoreEnrolAction.BROWSER;

    /**
     * @inheritdoc
     */
    async isEnabled(): Promise<boolean> {
        return true;
    }

}

export const AddonEnrolIrclassPaidUsersHandler = makeSingleton(AddonEnrolIrclassPaidUsersHandlerService);

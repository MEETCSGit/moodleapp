// Cordova after_prepare hook.
//
// @moodlehq/phonegap-plugin-push hardcodes `#import "Moodle-Swift.h"` in EncryptionHandler.m. Xcode names that generated
// header after the product module name, which Cordova derives from <name> in config.xml. When the app is renamed for a
// client (e.g. "IRClass Academy" -> "IRClass_Academy-Swift.h") the import breaks the iOS build.
// Pin the generated header name so it no longer depends on the app name.

const fs = require('fs');
const path = require('path');

const HEADER_NAME = 'Moodle-Swift.h';

module.exports = function(context) {
    if (!context.opts.platforms || !context.opts.platforms.includes('ios')) {
        return;
    }

    const xcode = require('xcode');
    const pbxprojPath = path.join(context.opts.projectRoot, 'platforms', 'ios', 'App.xcodeproj', 'project.pbxproj');

    if (!fs.existsSync(pbxprojPath)) {
        throw new Error(`Xcode project not found: ${pbxprojPath}`);
    }

    const project = xcode.project(pbxprojPath);
    project.parseSync();
    project.updateBuildProperty('SWIFT_OBJC_INTERFACE_HEADER_NAME', `"${HEADER_NAME}"`, null, 'App');
    fs.writeFileSync(pbxprojPath, project.writeSync());

    console.log(`Set SWIFT_OBJC_INTERFACE_HEADER_NAME to ${HEADER_NAME} for the App target.`);
};

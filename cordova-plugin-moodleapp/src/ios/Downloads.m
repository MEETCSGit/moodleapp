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

#import <Cordova/CDVPlugin.h>
#import <UIKit/UIKit.h>

/**
 * Saves a copy of a downloaded file (certificate, invoice) where the learner chooses in the Files app, for example the
 * Downloads folder: iOS has no shared Downloads folder that an app can write to directly, so this shows the system
 * "Save to Files" screen with the file name.
 */
@interface Downloads : CDVPlugin <UIDocumentPickerDelegate>

@property (nonatomic, copy) NSString *callbackId;
@property (nonatomic, strong) NSURL *tempFile;

- (void)saveToDownloads:(CDVInvokedUrlCommand *)command;

@end

@implementation Downloads

- (void)saveToDownloads:(CDVInvokedUrlCommand *)command
{
    NSString *source = [command argumentAtIndex:0 withDefault:@""];
    NSString *name = [command argumentAtIndex:1 withDefault:@"file.pdf"];
    NSURL *sourceUrl = [source hasPrefix:@"file:"] ? [NSURL URLWithString:source] : [NSURL fileURLWithPath:source];

    if (sourceUrl == nil || ![[NSFileManager defaultManager] fileExistsAtPath:sourceUrl.path]) {
        [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR
                                                                 messageAsString:@"file_not_found"]
                                    callbackId:command.callbackId];
        return;
    }

    // Copy with the real file name, so the Save to Files screen shows it (the app stores files under generated names).
    NSString *safeName = [[name componentsSeparatedByString:@"/"] componentsJoinedByString:@"-"];
    NSURL *temp = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:safeName]];
    NSFileManager *manager = [NSFileManager defaultManager];
    [manager removeItemAtURL:temp error:nil];
    NSError *error = nil;
    if (![manager copyItemAtURL:sourceUrl toURL:temp error:&error]) {
        [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR
                                                                 messageAsString:@"save_failed"]
                                    callbackId:command.callbackId];
        return;
    }

    self.callbackId = command.callbackId;
    self.tempFile = temp;

    dispatch_async(dispatch_get_main_queue(), ^{
        UIDocumentPickerViewController *picker = [[UIDocumentPickerViewController alloc] initForExportingURLs:@[temp]
                                                                                                       asCopy:YES];
        picker.delegate = self;
        picker.modalPresentationStyle = UIModalPresentationFormSheet;
        [self.viewController presentViewController:picker animated:YES completion:nil];
    });
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls
{
    NSURL *saved = urls.firstObject;
    [self finishWithResult:@{
        @"saved": @YES,
        @"name": saved.lastPathComponent ?: (self.tempFile.lastPathComponent ?: @""),
        @"location": saved.URLByDeletingLastPathComponent.lastPathComponent ?: @"",
    }];
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller
{
    [self finishWithResult:@{ @"saved": @NO, @"name": @"", @"location": @"" }];
}

- (void)finishWithResult:(NSDictionary *)result
{
    if (self.tempFile) {
        [[NSFileManager defaultManager] removeItemAtURL:self.tempFile error:nil];
        self.tempFile = nil;
    }
    if (self.callbackId) {
        [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                                             messageAsDictionary:result]
                                    callbackId:self.callbackId];
        self.callbackId = nil;
    }
}

@end

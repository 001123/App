// Web and desktop implementation only. Do not import for direct use. Use LocalNotification.
import Str from 'expensify-common/lib/str';
import _ from 'underscore';
import EXPENSIFY_ICON_URL from '@assets/images/expensify-logo-round-clearspace.png';
import * as ReportUtils from '@libs/ReportUtils';
import * as AppUpdate from '@userActions/AppUpdate';
import focusApp from './focusApp';

const notificationCache = [];

/**
 * Checks if the user has granted permission to show browser notifications
 *
 * @return {Promise}
 */
function canUseBrowserNotifications() {
    return new Promise((resolve) => {
        // They have no browser notifications so we can't use this feature
        if (!window.Notification) {
            return resolve(false);
        }

        // Check if they previously granted or denied us access to send a notification
        const permissionGranted = Notification.permission === 'granted';

        if (permissionGranted || Notification.permission === 'denied') {
            return resolve(permissionGranted);
        }

        // Check their global preferences for browser notifications and ask permission if they have none
        Notification.requestPermission().then((status) => {
            resolve(status === 'granted');
        });
    });
}

/**
 * Light abstraction around browser push notifications.
 * Checks for permission before determining whether to send.
 *
 * @param {String} title
 * @param {String} body
 * @param {String} icon Path to icon
 * @param {Object} data extra data to attach to the notification
 * @param {Function} onClick
 */
function push(title, body, icon = '', data = {}, onClick = () => {}) {
    if (!title || !body) {
        throw new Error('BrowserNotification must include title and body parameter.');
    }

    canUseBrowserNotifications().then((canUseNotifications) => {
        if (!canUseNotifications) {
            return;
        }

        const notificationID = Str.guid();
        notificationCache[notificationID] = new Notification(title, {
            body,
            icon,
            data,
        });
        notificationCache[notificationID].onclick = () => {
            onClick();
            window.parent.focus();
            window.focus();
            focusApp();
            notificationCache[notificationID].close();
        };
        notificationCache[notificationID].onclose = () => {
            delete notificationCache[notificationID];
        };
    });
}

/**
 * BrowserNotification
 * @namespace
 */
export default {
    /**
     * Create a report comment notification
     *
     * @param {Object} report
     * @param {Object} reportAction
     * @param {Function} onClick
     * @param {Boolean} usesIcon true if notification uses right circular icon
     */
    pushReportCommentNotification(report, reportAction, onClick, usesIcon = false) {
        let title;
        let body;
        const icon = usesIcon ? EXPENSIFY_ICON_URL : '';

        const isChatRoom = ReportUtils.isChatRoom(report);

        const {person, message} = reportAction;
        const plainTextPerson = _.map(person, (f) => f.text).join();

        // Specifically target the comment part of the message
        const plainTextMessage = (_.find(message, (f) => f.type === 'COMMENT') || {}).text;

        if (isChatRoom) {
            const roomName = ReportUtils.getReportName(report);
            title = roomName;
            body = `${plainTextPerson}: ${plainTextMessage}`;
        } else {
            title = plainTextPerson;
            body = plainTextMessage;
        }

        const data = {
            reportID: report.reportID,
        };

        push(title, body, icon, data, onClick);
    },

    pushModifiedExpenseNotification(report, reportAction, onClick, usesIcon = false) {
        const title = _.map(reportAction.person, (f) => f.text).join(', ');
        const body = ReportUtils.getModifiedExpenseMessage(reportAction);
        const icon = usesIcon ? EXPENSIFY_ICON_URL : '';
        const data = {
            reportID: report.reportID,
        };
        push(title, body, icon, data, onClick);
    },

    /**
     * Create a notification to indicate that an update is available.
     */
    pushUpdateAvailableNotification() {
        push('Update available', 'A new version of this app is available!', {}, () => {
            AppUpdate.triggerUpdateAvailable();
        });
    },

    clearNotifications(shouldClearNotification) {
        if (!_.isFunction(shouldClearNotification)) {
            return;
        }

        _.keys(notificationCache).forEach((notificationID) => {
            const notification = notificationCache[notificationID];

            if (shouldClearNotification(notification.data)) {
                notification.close();
            }
        });
    },
};

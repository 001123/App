import type {RouteProp} from '@react-navigation/native';
import {useIsFocused, useRoute} from '@react-navigation/native';
import {useEffect, useRef} from 'react';
import {InteractionManager} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import Navigation from '@libs/Navigation/Navigation';
import type {CentralPaneNavigatorParamList} from '@libs/Navigation/types';
import * as Report from '@userActions/Report';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';

type UserTypingEventListenerOnyxProps = {
    /** Stores last visited path */
    lastVisitedPath?: string;
};

type UserTypingEventListenerProps = UserTypingEventListenerOnyxProps & {
    /** The report currently being looked at */
    report: OnyxTypes.Report;
};
function UserTypingEventListener({report, lastVisitedPath}: UserTypingEventListenerProps) {
    const didSubscribeToReportTypingEvents = useRef(false);
    const reportID = report.reportID;
    const isFocused = useIsFocused();
    const route = useRoute<RouteProp<CentralPaneNavigatorParamList, typeof SCREENS.REPORT>>();
    useEffect(() => {
        // Ensures the optimistic report is created successfully
        if (route?.params?.reportID !== reportID) {
            return;
        }

        if (isFocused) {
            // Ensures subscription event succeeds when the report/workspace room is created optimistically.
            // Check if the optimistic `OpenReport` or `AddWorkspaceRoom` has succeeded by confirming
            // any `pendingFields.createChat` or `pendingFields.addWorkspaceRoom` fields are set to null.
            // Existing reports created will have empty fields for `pendingFields`.
            const didCreateReportSuccessfully = !report.pendingFields || (!report.pendingFields.addWorkspaceRoom && !report.pendingFields.createChat);

            if (!didSubscribeToReportTypingEvents.current && didCreateReportSuccessfully) {
                const interactionTask = InteractionManager.runAfterInteractions(() => {
                    Report.subscribeToReportTypingEvents(reportID);
                    didSubscribeToReportTypingEvents.current = true;
                });
                return () => {
                    interactionTask.cancel();
                };
            }
        } else {
            const topmostReportId = Navigation.getTopmostReportId();

            if (topmostReportId !== report.reportID && didSubscribeToReportTypingEvents.current) {
                didSubscribeToReportTypingEvents.current = false;
                InteractionManager.runAfterInteractions(() => {
                    Report.unsubscribeFromReportChannel(report.reportID);
                });
            }
        }
    }, [isFocused, report.reportID, report.pendingFields, didSubscribeToReportTypingEvents, lastVisitedPath, reportID, route]);

    return null;
}

UserTypingEventListener.displayName = 'UserTypingEventListener';

export default withOnyx<UserTypingEventListenerProps, UserTypingEventListenerOnyxProps>({
    lastVisitedPath: {
        key: ONYXKEYS.LAST_VISITED_PATH,
        selector: (path) => path ?? '',
    },
})(UserTypingEventListener);

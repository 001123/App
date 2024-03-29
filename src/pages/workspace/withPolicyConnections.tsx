import {useEffect, useState} from 'react';
import type {ComponentType} from 'react';
import FullPageOfflineBlockingView from '@components/BlockingViews/FullPageOfflineBlockingView';
import useNetwork from '@hooks/useNetwork';
import {openPolicyAccountingPage} from '@libs/actions/PolicyConnections';
import withPolicy from './withPolicy';
import type {WithPolicyProps} from './withPolicy';

type WithPolicyConnectionsProps = WithPolicyProps;

/**
 * Higher-order component that fetches the connections data and populates
 * the corresponding field of the policy object if the field is empty. It then passes the policy object
 * to the wrapped component.
 *
 * Use this HOC when you need the policy object with its connections field populated.
 *
 * Only the active policy gets the complete policy data upon app start that includes the connections data.
 * For other policies, the connections data needs to be fetched when it's needed.
 */
function withPolicyConnections(WrappedComponent: ComponentType<WithPolicyConnectionsProps>) {
    /**
     * Higher-order component that adds policy connections functionality to a component.
     *
     * @component
     * @param {WithPolicyConnectionsProps} props - The props for the component.
     * @returns {JSX.Element | null} The wrapped component with policy connections functionality.
     */
    /**
     * Higher-order component that adds policy connections functionality to a component.
     *
     * @param {WithPolicyConnectionsProps} props - The props for the component.
     * @returns {React.ReactNode} - The wrapped component.
     */
    function WithPolicyConnections({policy, policyMembers, policyDraft, policyMembersDraft, route}: WithPolicyConnectionsProps) {
        const {isOffline} = useNetwork();

        // When the accounting feature is enabled, but the user hasn't connected to any accounting software,
        // the connections data doesn't exist. We don't want to continually attempt to fetch non-existent data.
        // This state helps us track whether a data fetch attempt has been made.
        const [wasConnectionsDataFetched, setWasConnectionsDataFetched] = useState(false);

        useEffect(() => {
            // When the accounting feature is not enabled, or if the connections data already exists,
            // there is no need to fetch the connections data.
            if (wasConnectionsDataFetched || !policy?.areConnectionsEnabled || !!policy?.connections || !policy?.id) {
                return;
            }

            openPolicyAccountingPage(policy.id);
            setWasConnectionsDataFetched(true);
        }, [policy, wasConnectionsDataFetched]);

        if (!policy?.connections) {
            if (isOffline) {
                return (
                    <FullPageOfflineBlockingView>
                        <WrappedComponent
                            policy={policy}
                            policyMembers={policyMembers}
                            policyDraft={policyDraft}
                            policyMembersDraft={policyMembersDraft}
                            route={route}
                        />
                    </FullPageOfflineBlockingView>
                );
            }

            return null;
        }

        return (
            <WrappedComponent
                policy={policy}
                policyMembers={policyMembers}
                policyDraft={policyDraft}
                policyMembersDraft={policyMembersDraft}
                route={route}
            />
        );
    }

    return withPolicy(WithPolicyConnections);
}

export default withPolicyConnections;

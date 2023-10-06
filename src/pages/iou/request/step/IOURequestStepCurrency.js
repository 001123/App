// TODO: This file came from IOURequestStepCurrency.js and that file needs to be removed and cleaned up to ensure any additinal functionality is included here
import React, {useState, useMemo, useRef} from 'react';
import PropTypes from 'prop-types';
import {withOnyx} from 'react-native-onyx';
import _ from 'underscore';
import lodashGet from 'lodash/get';
import Str from 'expensify-common/lib/str';
import ONYXKEYS from '../../../../ONYXKEYS';
import OptionsSelector from '../../../../components/OptionsSelector';
import Navigation from '../../../../libs/Navigation/Navigation';
import * as CurrencyUtils from '../../../../libs/CurrencyUtils';
import ROUTES from '../../../../ROUTES';
import themeColors from '../../../../styles/themes/default';
import * as Expensicons from '../../../../components/Icon/Expensicons';
import transactionPropTypes from '../../../../components/transactionPropTypes';
import useLocalize from '../../../../hooks/useLocalize';
import * as IOU from '../../../../libs/actions/IOU';
import StepScreenWrapper from './StepScreenWrapper';
import * as IOUUtils from '../../../../libs/IOUUtils';

const greenCheckmark = {src: Expensicons.Checkmark, color: themeColors.success};

/**
 * IOU Currency selection for selecting currency
 */
const propTypes = {
    /** Route from navigation */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The type of iou (eg. scan/manual/distance) */
            iouType: PropTypes.string,

            /** The report ID of the IOU's report */
            reportID: PropTypes.string,

            /** The transaction ID of the IOU */
            transactionID: PropTypes.string,

            /** A path to go to when the user presses the back button */
            backTo: PropTypes.string,
        }),
    }).isRequired,

    /** The currency list constant object from Onyx */
    currencyList: PropTypes.objectOf(
        PropTypes.shape({
            /** Symbol for the currency */
            symbol: PropTypes.string,

            /** Name of the currency */
            name: PropTypes.string,

            /** ISO4217 Code for the currency */
            ISO4217: PropTypes.string,
        }),
    ),

    /* Onyx Props */
    /** The transaction being modified */
    transaction: transactionPropTypes,
};

const defaultProps = {
    currencyList: {},
    transaction: {},
};

function IOURequestStepCurrency({
    route: {
        params: {iouType, transactionID, backTo},
    },
    currencyList,
    transaction: {currency},
}) {
    const {translate} = useLocalize();
    const [searchValue, setSearchValue] = useState('');
    const optionsSelectorRef = useRef();

    const navigateBack = () => {
        Navigation.goBack(backTo || ROUTES.HOME, true);
    };

    const confirmCurrencySelection = (option) => {
        IOU.setMoneeRequestCurrency(transactionID, option.currencyCode);
        navigateBack();
    };

    const {sections, headerMessage, initiallyFocusedOptionKey} = useMemo(() => {
        const currencyOptions = _.map(currencyList, (currencyInfo, currencyCode) => {
            const isSelectedCurrency = currencyCode === currency.toUpperCase();
            return {
                currencyName: currencyInfo.name,
                text: `${currencyCode} - ${CurrencyUtils.getLocalizedCurrencySymbol(currencyCode)}`,
                currencyCode,
                keyForList: currencyCode,
                customIcon: isSelectedCurrency ? greenCheckmark : undefined,
                boldStyle: isSelectedCurrency,
            };
        });

        const searchRegex = new RegExp(Str.escapeForRegExp(searchValue.trim()), 'i');
        const filteredCurrencies = _.filter(currencyOptions, (currencyOption) => searchRegex.test(currencyOption.text) || searchRegex.test(currencyOption.currencyName));
        const isEmpty = searchValue.trim() && !filteredCurrencies.length;

        return {
            initiallyFocusedOptionKey: _.get(
                _.find(filteredCurrencies, (filteredCurrency) => filteredCurrency.currencyCode === currency.toUpperCase()),
                'keyForList',
            ),
            sections: isEmpty
                ? []
                : [
                      {
                          title: translate('common.allCurrencies'),
                          data: filteredCurrencies,
                          shouldShow: true,
                          indexOffset: 0,
                      },
                  ],
            headerMessage: isEmpty ? translate('common.noResultsFound') : '',
        };
    }, [currencyList, searchValue, currency, translate]);

    return (
        <StepScreenWrapper
            headerTitle={translate('common.selectCurrency')}
            onBackButtonPress={navigateBack}
            onEntryTransitionEnd={() => optionsSelectorRef.current && optionsSelectorRef.current.focus()}
            shouldShowNotFound={!IOUUtils.isValidMoneyRequestType(iouType)}
            shouldShowWrapper
            testID={IOURequestStepCurrency.displayName}
        >
            <OptionsSelector
                sections={sections}
                onSelectRow={confirmCurrencySelection}
                value={searchValue}
                onChangeText={setSearchValue}
                textInputLabel={translate('common.search')}
                headerMessage={headerMessage}
                initiallyFocusedOptionKey={initiallyFocusedOptionKey}
                shouldHaveOptionSeparator
                autoFocus={false}
                ref={optionsSelectorRef}
            />
        </StepScreenWrapper>
    );
}

IOURequestStepCurrency.displayName = 'IOURequestStepCurrency';
IOURequestStepCurrency.propTypes = propTypes;
IOURequestStepCurrency.defaultProps = defaultProps;

export default withOnyx({
    currencyList: {key: ONYXKEYS.CURRENCY_LIST},
    transaction: {
        key: ({route}) => `${ONYXKEYS.COLLECTION.TRANSACTION}${lodashGet(route, 'params.transactionID', '0')}`,
    },
})(IOURequestStepCurrency);

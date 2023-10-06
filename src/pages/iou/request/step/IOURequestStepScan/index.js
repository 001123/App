// TODO: This file came from iou/ReceiptSelector/index.js and it needs cleaned up and have everything use this new file
import {View, Text, PanResponder, PixelRatio} from 'react-native';
import React, {useContext, useRef, useState} from 'react';
import lodashGet from 'lodash/get';
import _ from 'underscore';
import PropTypes from 'prop-types';
import {withOnyx} from 'react-native-onyx';
import ROUTES from '../../../../../ROUTES';
import * as IOU from '../../../../../libs/actions/IOU';
import CONST from '../../../../../CONST';
import ReceiptUpload from '../../../../../../assets/images/receipt-upload.svg';
import Button from '../../../../../components/Button';
import styles from '../../../../../styles/styles';
import CopyTextToClipboard from '../../../../../components/CopyTextToClipboard';
import ReceiptDropUI from '../../../ReceiptDropUI';
import AttachmentPicker from '../../../../../components/AttachmentPicker';
import ConfirmModal from '../../../../../components/ConfirmModal';
import ONYXKEYS from '../../../../../ONYXKEYS';
import useWindowDimensions from '../../../../../hooks/useWindowDimensions';
import useLocalize from '../../../../../hooks/useLocalize';
import {DragAndDropContext} from '../../../../../components/DragAndDrop/Provider';
import * as FileUtils from '../../../../../libs/fileDownload/FileUtils';
import Navigation from '../../../../../libs/Navigation/Navigation';
import reportPropTypes from '../../../../reportPropTypes';

const propTypes = {
    /** React Navigation route */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The type of IOU report, i.e. bill, request, send */
            iouType: PropTypes.string,

            /** The ID of the transaction being configured */
            transactionID: PropTypes.string,

            /** The report ID of the IOU */
            reportID: PropTypes.string,
        }),

        /** The current route path */
        path: PropTypes.string,
    }).isRequired,

    /* Onyx Props */
    /** The report on which the request is initiated on */
    report: reportPropTypes,
};

const defaultProps = {
    report: {},
};

function ReceiptSelector({
    route: {
        params: {iouType, reportID, transactionID},
    },
}) {
    const [isAttachmentInvalid, setIsAttachmentInvalid] = useState(false);
    const [attachmentInvalidReasonTitle, setAttachmentInvalidReasonTitle] = useState('');
    const [attachmentInvalidReason, setAttachmentValidReason] = useState('');
    const [receiptImageTopPosition, setReceiptImageTopPosition] = useState(0);
    const {isSmallScreenWidth} = useWindowDimensions();
    const {translate} = useLocalize();
    const {isDraggingOver} = useContext(DragAndDropContext);

    const hideReciptModal = () => {
        setIsAttachmentInvalid(false);
    };

    /**
     * Sets the upload receipt error modal content when an invalid receipt is uploaded
     * @param {*} isInvalid
     * @param {*} title
     * @param {*} reason
     */
    const setUploadReceiptError = (isInvalid, title, reason) => {
        setIsAttachmentInvalid(isInvalid);
        setAttachmentInvalidReasonTitle(title);
        setAttachmentValidReason(reason);
    };

    function validateReceipt(file) {
        const {fileExtension} = FileUtils.splitExtensionFromFileName(lodashGet(file, 'name', ''));
        if (_.contains(CONST.API_ATTACHMENT_VALIDATIONS.UNALLOWED_EXTENSIONS, fileExtension.toLowerCase())) {
            setUploadReceiptError(true, 'attachmentPicker.wrongFileType', 'attachmentPicker.notAllowedExtension');
            return false;
        }

        if (lodashGet(file, 'size', 0) > CONST.API_ATTACHMENT_VALIDATIONS.MAX_SIZE) {
            setUploadReceiptError(true, 'attachmentPicker.attachmentTooLarge', 'attachmentPicker.sizeExceeded');
            return false;
        }

        if (lodashGet(file, 'size', 0) < CONST.API_ATTACHMENT_VALIDATIONS.MIN_SIZE) {
            setUploadReceiptError(true, 'attachmentPicker.attachmentTooSmall', 'attachmentPicker.sizeNotMet');
            return false;
        }

        return true;
    }

    /**
     * Sets the Receipt objects and navigates the user to the next page
     * @param {Object} file
     */
    const setReceiptAndNavigate = (file) => {
        if (!validateReceipt(file)) {
            return;
        }

        const filePath = URL.createObjectURL(file);
        IOU.setMoneeRequestReceipt(transactionID, filePath, file.name);

        // TODO: Figure out what this does and if we need to account for it
        // if (transactionID) {
        //     IOU.replaceReceipt(transactionID, file, filePath);
        //     Navigation.dismissModal();
        //     return;
        // }

        Navigation.navigate(ROUTES.MONEE_REQUEST_STEP.getRoute(iouType, CONST.IOU.REQUEST_STEPS.CONFIRMATION, transactionID, reportID));
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
        }),
    ).current;

    return (
        <View style={[styles.uploadReceiptView(isSmallScreenWidth)]}>
            {!isDraggingOver ? (
                <>
                    <View
                        onLayout={({nativeEvent}) => {
                            setReceiptImageTopPosition(PixelRatio.roundToNearestPixel(nativeEvent.layout.top));
                        }}
                    >
                        <ReceiptUpload
                            width={CONST.RECEIPT.ICON_SIZE}
                            height={CONST.RECEIPT.ICON_SIZE}
                        />
                    </View>
                    <View
                        style={styles.receiptViewTextContainer}
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...panResponder.panHandlers}
                    >
                        <Text style={[styles.textReceiptUpload]}>{translate('receipt.upload')}</Text>
                        <Text style={[styles.subTextReceiptUpload]}>
                            {isSmallScreenWidth ? translate('receipt.chooseReceipt') : translate('receipt.dragReceiptBeforeEmail')}
                            <CopyTextToClipboard
                                text={CONST.EMAIL.RECEIPTS}
                                textStyles={[styles.textBlue]}
                            />
                            {isSmallScreenWidth ? null : translate('receipt.dragReceiptAfterEmail')}
                        </Text>
                    </View>
                    <AttachmentPicker>
                        {({openPicker}) => (
                            <Button
                                medium
                                success
                                text={translate('receipt.chooseFile')}
                                accessibilityLabel={translate('receipt.chooseFile')}
                                style={[styles.p9]}
                                onPress={() => {
                                    openPicker({
                                        onPicked: setReceiptAndNavigate,
                                    });
                                }}
                            />
                        )}
                    </AttachmentPicker>
                </>
            ) : null}
            <ReceiptDropUI
                onDrop={(e) => {
                    const file = lodashGet(e, ['dataTransfer', 'files', 0]);
                    setReceiptAndNavigate(file);
                }}
                receiptImageTopPosition={receiptImageTopPosition}
            />
            <ConfirmModal
                title={attachmentInvalidReasonTitle ? translate(attachmentInvalidReasonTitle) : ''}
                onConfirm={hideReciptModal}
                onCancel={hideReciptModal}
                isVisible={isAttachmentInvalid}
                prompt={attachmentInvalidReason ? translate(attachmentInvalidReason) : ''}
                confirmText={translate('common.close')}
                shouldShowCancelButton={false}
            />
        </View>
    );
}

ReceiptSelector.defaultProps = defaultProps;
ReceiptSelector.propTypes = propTypes;
ReceiptSelector.displayName = 'ReceiptSelector';

export default withOnyx({
    report: {
        key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT}${lodashGet(route, 'params.reportID', '0')}`,
    },
})(ReceiptSelector);

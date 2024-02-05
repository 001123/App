/* eslint-disable react/jsx-props-no-spreading */
import Str from 'expensify-common/lib/str';
import React from 'react';
import type {ViewStyle} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import AttachmentModal from '@components/AttachmentModal';
import PressableWithoutFocus from '@components/Pressable/PressableWithoutFocus';
import type {ReceiptImageProps} from '@components/ReceiptImage';
import ReceiptImage from '@components/ReceiptImage';
import {ShowContextMenuContext} from '@components/ShowContextMenuContext';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as TransactionUtils from '@libs/TransactionUtils';
import tryResolveUrlFromApiRoot from '@libs/tryResolveUrlFromApiRoot';
import CONST from '@src/CONST';
import type {Transaction} from '@src/types/onyx';

type ReportActionItemImageProps = {
    /** thumbnail URI for the image */
    thumbnail?: string;

    /** The file type of the receipt */
    fileExtension?: string;

    /** whether or not we are going to display a thumbnail */
    isThumbnail?: boolean;

    /** URI for the image or local numeric reference for the image  */
    image?: string;

    /** whether or not to enable the image preview modal */
    enablePreviewModal?: boolean;

    /* The transaction associated with this image, if any. Passed for handling eReceipts. */
    transaction?: OnyxEntry<Transaction>;

    /** whether thumbnail is refer the local file or not */
    isLocalFile?: boolean;

    /** whether the receipt can be replaced */
    canEditReceipt?: boolean;

    /** Filename of attachment */
    filename?: string;
};

/**
 * An image with an optional thumbnail that fills its parent container. If the thumbnail is passed,
 * we try to resolve both the image and thumbnail from the API. Similar to ImageRenderer, we show
 * and optional preview modal as well.
 */

function ReportActionItemImage({
    thumbnail,
    isThumbnail,
    image,
    enablePreviewModal = false,
    transaction,
    canEditReceipt = false,
    isLocalFile = false,
    fileExtension,
    filename,
}: ReportActionItemImageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const imageSource = tryResolveUrlFromApiRoot(image ?? '');
    const thumbnailSource = tryResolveUrlFromApiRoot(thumbnail ?? '');
    const isEReceipt = transaction && TransactionUtils.hasEReceipt(transaction);

    let propsObj: ReceiptImageProps;

    if (isEReceipt) {
        propsObj = {isEReceipt: true, transactionID: transaction.transactionID};
    } else if (thumbnail && !isLocalFile && !Str.isPDF(imageSource)) {
        propsObj = {shouldUseThumbnailImage: true, source: thumbnailSource};
    } else {
        propsObj = {isThumbnail, fileExtension, transactionID: transaction?.transactionID, source: thumbnail ?? image};
    }

    if (enablePreviewModal) {
        return (
            <ShowContextMenuContext.Consumer>
                {({report}) => (
                    <AttachmentModal
                        source={imageSource}
                        isAuthTokenRequired={!isLocalFile}
                        report={report}
                        isReceiptAttachment
                        canEditReceipt={canEditReceipt}
                        allowDownload
                        originalFileName={filename}
                    >
                        {({show}) => (
                            <PressableWithoutFocus
                                style={[styles.w100, styles.h100, styles.noOutline as ViewStyle]}
                                onPress={show}
                                accessibilityRole={CONST.ROLE.BUTTON}
                                accessibilityLabel={translate('accessibilityHints.viewAttachment')}
                            >
                                <ReceiptImage {...propsObj} />
                            </PressableWithoutFocus>
                        )}
                    </AttachmentModal>
                )}
            </ShowContextMenuContext.Consumer>
        );
    }

    return <ReceiptImage {...propsObj} />;
}

ReportActionItemImage.displayName = 'ReportActionItemImage';

export default ReportActionItemImage;

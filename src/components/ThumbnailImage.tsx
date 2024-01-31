import React, {useCallback, useState} from 'react';
import type {ImageSourcePropType, StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';
import useThumbnailDimensions from '@hooks/useThumbnailDimensions';
import ImageWithSizeCalculation from './ImageWithSizeCalculation';

type ThumbnailImageProps = {
    /** Source URL for the preview image */
    previewSourceURL: string | ImageSourcePropType;

    /** Any additional styles to apply */
    style?: StyleProp<ViewStyle>;

    /** Whether the image requires an authToken */
    isAuthTokenRequired: boolean;

    /** Width of the thumbnail image */
    imageWidth?: number;

    /** Height of the thumbnail image */
    imageHeight?: number;

    /** Should the image be resized on load or just fit container */
    shouldDynamicallyResize?: boolean;
};

type UpdateImageSizeParams = {
    width: number;
    height: number;
};

function ThumbnailImage({previewSourceURL, style, isAuthTokenRequired, imageWidth = 200, imageHeight = 200, shouldDynamicallyResize = true}: ThumbnailImageProps) {
    const styles = useThemeStyles();
    const [imageDimensions, setImageDimensions] = useState({width: imageWidth, height: imageHeight});
    const {thumbnailDimensionsStyles} = useThumbnailDimensions(imageDimensions.width, imageDimensions.height);

    /**
     * Update the state with the computed thumbnail sizes.
     * @param Params - width and height of the original image.
     */
    const updateImageSize = useCallback(
        ({width, height}: UpdateImageSizeParams) => {
            if (!shouldDynamicallyResize) {
                return;
            }
            setImageDimensions({width, height});
        },
        [shouldDynamicallyResize],
    );

    const sizeStyles = shouldDynamicallyResize ? [thumbnailDimensionsStyles] : [styles.w100, styles.h100];

    return (
        <View style={[style, styles.overflowHidden]}>
            <View style={[...sizeStyles, styles.alignItemsCenter, styles.justifyContentCenter]}>
                <ImageWithSizeCalculation
                    url={previewSourceURL}
                    onMeasure={updateImageSize}
                    isAuthTokenRequired={isAuthTokenRequired}
                />
            </View>
        </View>
    );
}

ThumbnailImage.displayName = 'ThumbnailImage';
export default React.memo(ThumbnailImage);

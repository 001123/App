import {SvgProps} from 'react-native-svg';
import moment from 'moment';
import Str from 'expensify-common/lib/str';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '../ONYXKEYS';
import CONST from '../CONST';
import emojisTrie from './EmojiTrie';
import * as Emojis from '../../assets/emojis';
import * as OnyxTypes from '../types/onyx';
import {Emoji, HeaderEmoji} from '../../assets/emojis/types';

type HeaderIndice = {code: string; index: number; icon: React.FC<SvgProps>};
type EmojiSpacer = {code: string; spacer: boolean};

let frequentlyUsedEmojis: OnyxTypes.FrequentlyUsedEmoji[] = [];
Onyx.connect({
    key: ONYXKEYS.FREQUENTLY_USED_EMOJIS,
    callback: (val) => {
        if (!val) {
            return;
        }
        frequentlyUsedEmojis =
            val
                ?.map((item) => {
                    const emoji = Emojis.emojiCodeTableWithSkinTones[item.code];
                    return {...emoji, count: item.count, lastUpdatedAt: item.lastUpdatedAt};
                })
                .filter((emoji): emoji is OnyxTypes.FrequentlyUsedEmoji => !!emoji) ?? [];
    },
});

const findEmojiByName = (name: string) => Emojis.emojiNameTable[name];

const findEmojiByCode = (code: string) => Emojis.emojiCodeTableWithSkinTones[code];

const getEmojiName = (emoji: Emoji, lang: 'en' | 'es' = CONST.LOCALES.DEFAULT) => {
    if (lang === CONST.LOCALES.DEFAULT) {
        return emoji.name;
    }

    return Emojis.localeEmojis?.[lang]?.[emoji.code]?.name ?? '';
};

/**
 * Given an English emoji name, get its localized version
 */
const getLocalizedEmojiName = (name: string, lang: 'en' | 'es') => {
    if (lang === CONST.LOCALES.DEFAULT) {
        return name;
    }

    const emojiCode = Emojis.emojiNameTable[name]?.code ?? '';
    return Emojis.localeEmojis[lang]?.[emojiCode]?.name ?? '';
};

/**
 * Get the unicode code of an emoji in base 16.
 */
const getEmojiUnicode = _.memoize((input: string) => {
    if (input.length === 0) {
        return '';
    }

    if (input.length === 1) {
        return input
            .charCodeAt(0)
            .toString()
            .split(' ')
            .map((val) => parseInt(val, 10).toString(16))
            .join(' ');
    }

    const pairs = [];

    // Some Emojis in UTF-16 are stored as pair of 2 Unicode characters (eg Flags)
    // The first char is generally between the range U+D800 to U+DBFF called High surrogate
    // & the second char between the range U+DC00 to U+DFFF called low surrogate
    // More info in the following links:
    // 1. https://docs.microsoft.com/en-us/windows/win32/intl/surrogates-and-supplementary-characters
    // 2. https://thekevinscott.com/emojis-in-javascript/
    for (let i = 0; i < input.length; i++) {
        if (input.charCodeAt(i) >= 0xd800 && input.charCodeAt(i) <= 0xdbff) {
            // high surrogate
            if (input.charCodeAt(i + 1) >= 0xdc00 && input.charCodeAt(i + 1) <= 0xdfff) {
                // low surrogate
                pairs.push((input.charCodeAt(i) - 0xd800) * 0x400 + (input.charCodeAt(i + 1) - 0xdc00) + 0x10000);
            }
        } else if (input.charCodeAt(i) < 0xd800 || input.charCodeAt(i) > 0xdfff) {
            // modifiers and joiners
            pairs.push(input.charCodeAt(i));
        }
    }
    return pairs.map((val) => parseInt(String(val), 10).toString(16)).join(' ');
});

/**
 * Function to remove Skin Tone and utf16 surrogates from Emoji
 */
function trimEmojiUnicode(emojiCode: string) {
    return emojiCode.replace(/(fe0f|1f3fb|1f3fc|1f3fd|1f3fe|1f3ff)$/, '').trim();
}

/**
 * Validates that this message contains only emojis
 */
function containsOnlyEmojis(message: string): boolean {
    const trimmedMessage = Str.replaceAll(message.replace(/ /g, ''), '\n', '');
    const match = trimmedMessage.match(CONST.REGEX.EMOJIS);

    if (!match) {
        return false;
    }

    const codes = [];
    match.map((emoji) =>
        getEmojiUnicode(emoji)
            .split(' ')
            .map((code) => {
                if (!(CONST.INVISIBLE_CODEPOINTS as readonly string[]).includes(code)) {
                    codes.push(code);
                }
                return code;
            }),
    );

    // Emojis are stored as multiple characters, so we're using spread operator
    // to iterate over the actual emojis, not just characters that compose them
    const messageCodes = [...trimmedMessage]
        .map((char) => getEmojiUnicode(char))
        .filter((string) => string.length > 0 && !(CONST.INVISIBLE_CODEPOINTS as readonly string[]).includes(string));
    return codes.length === messageCodes.length;
}

/**
 * Get the header emojis with their code, icon and index
 */
function getHeaderEmojis(emojis: Array<Emoji | HeaderEmoji>): HeaderIndice[] {
    // TODO - move into separate type
    const headerIndices: HeaderIndice[] = [];
    emojis.forEach((emoji, index) => {
        if (!('header' in emoji)) {
            // TODO - ask BK why it doesn't work the other way
            return;
        }
        headerIndices.push({code: emoji.code, index, icon: emoji.icon});
    });
    return headerIndices;
}

/**
 * Get number of empty spaces to be filled to get equal emojis for every row
 */
function getDynamicSpacing(emojiCount: number, suffix: number): EmojiSpacer[] {
    const spacerEmojis = [];
    let modLength = CONST.EMOJI_NUM_PER_ROW - (emojiCount % CONST.EMOJI_NUM_PER_ROW);

    // Empty spaces is pushed if the given row has less than eight emojis
    while (modLength > 0 && modLength < CONST.EMOJI_NUM_PER_ROW) {
        spacerEmojis.push({
            code: `${CONST.EMOJI_SPACER}_${suffix}_${modLength}`,
            spacer: true,
        });
        modLength -= 1;
    }
    return spacerEmojis;
}

/**
 * Add dynamic spaces to emoji categories
 */
function addSpacesToEmojiCategories(emojis: Array<Emoji | HeaderEmoji>) {
    let updatedEmojis: Array<EmojiSpacer | Emoji | HeaderEmoji> = [];
    emojis.forEach((emoji, index) => {
        if ('header' in emoji) {
            updatedEmojis = updatedEmojis.concat(getDynamicSpacing(updatedEmojis.length, index), [emoji], getDynamicSpacing(1, index));
            return;
        }
        updatedEmojis.push(emoji);
    });
    return updatedEmojis;
}

/**
 * Get a merged array with frequently used emojis
 */
function mergeEmojisWithFrequentlyUsedEmojis(emojis: Array<Emoji | HeaderEmoji>) {
    if (frequentlyUsedEmojis.length === 0) {
        return addSpacesToEmojiCategories(emojis);
    }

    const mergedEmojis = ([Emojis.categoryFrequentlyUsed] as Array<Emoji | HeaderEmoji>).concat(frequentlyUsedEmojis, emojis);
    return addSpacesToEmojiCategories(mergedEmojis);
}

/**
 * Get the updated frequently used emojis list by usage
 */
function getFrequentlyUsedEmojis(newEmoji: Emoji | Emoji[]) {
    let frequentEmojiList = [...frequentlyUsedEmojis];

    const maxFrequentEmojiCount = CONST.EMOJI_FREQUENT_ROW_COUNT * CONST.EMOJI_NUM_PER_ROW - 1;
    const currentTimestamp = moment().unix();
    ([] as Emoji[]).concat(newEmoji).forEach((emoji) => {
        let currentEmojiCount = 1;
        const emojiIndex = frequentEmojiList.findIndex((e) => e.code === emoji.code);
        if (emojiIndex >= 0) {
            currentEmojiCount = frequentEmojiList[emojiIndex].count + 1;
            frequentEmojiList.splice(emojiIndex, 1);
        }

        const updatedEmoji = {...Emojis.emojiCodeTableWithSkinTones[emoji.code], count: currentEmojiCount, lastUpdatedAt: currentTimestamp};

        // We want to make sure the current emoji is added to the list
        // Hence, we take one less than the current frequent used emojis
        frequentEmojiList = frequentEmojiList.slice(0, maxFrequentEmojiCount);
        frequentEmojiList.push(updatedEmoji);

        // Sort the list by count and lastUpdatedAt in descending order
        frequentEmojiList.sort((a, b) => b.count - a.count || b.lastUpdatedAt - a.lastUpdatedAt);
    });

    return frequentEmojiList;
}

/**
 * Given an emoji item object, return an emoji code based on its type.
 */
const getEmojiCodeWithSkinColor = (item: Emoji, preferredSkinToneIndex: number): string => {
    const {code, types} = item;
    if (types?.[preferredSkinToneIndex]) {
        return types[preferredSkinToneIndex];
    }

    return code;
};

/**
 * Extracts emojis from a given text.
 *
 * @param text - The text to extract emojis from.
 * @returns An array of emoji codes.
 */
function extractEmojis(text: string) {
    if (!text) {
        return [];
    }

    // Parse Emojis including skin tones - Eg: ['👩🏻', '👩🏻', '👩🏼', '👩🏻', '👩🏼', '👩']
    const parsedEmojis = text.match(CONST.REGEX.EMOJIS);

    if (!parsedEmojis) {
        return [];
    }

    const emojis = [];

    // Text can contain similar emojis as well as their skin tone variants. Create a Set to remove duplicate emojis from the search.
    const foundEmojiCodes = new Set();

    for (const character of parsedEmojis) {
        const emoji = Emojis.emojiCodeTableWithSkinTones[character];

        // Add the parsed emoji to the final emojis if not already present.
        if (emoji && !foundEmojiCodes.has(emoji.code)) {
            foundEmojiCodes.add(emoji.code);
            emojis.push(emoji);
        }
    }

    return emojis;
}

/**
 * Replace any emoji name in a text with the emoji icon.
 * If we're on mobile, we also add a space after the emoji granted there's no text after it.
 */
function replaceEmojis(text: string, preferredSkinTone = CONST.EMOJI_DEFAULT_SKIN_TONE, lang: 'en' | 'es' = CONST.LOCALES.DEFAULT) {
    const trie = emojisTrie[lang];
    if (!trie) {
        return {text, emojis: []};
    }

    let newText = text;
    const emojis: Emoji[] = [];
    const emojiData = text.match(CONST.REGEX.EMOJI_NAME);
    if (!emojiData || emojiData.length === 0) {
        return {text: newText, emojis};
    }
    for (let i = 0; i < emojiData.length; i++) {
        const name = emojiData[i].slice(1, -1);
        let checkEmoji = trie.search(name);
        // If the user has selected a language other than English, and the emoji doesn't exist in that language,
        // we will check if the emoji exists in English.
        if (lang !== CONST.LOCALES.DEFAULT && !checkEmoji?.metaData?.code) {
            const englishTrie = emojisTrie[CONST.LOCALES.DEFAULT];
            if (englishTrie) {
                const englishEmoji = englishTrie.search(name);
                checkEmoji = englishEmoji;
            }
        }
        if (checkEmoji?.metaData?.code && checkEmoji?.metaData?.name) {
            let emojiReplacement = getEmojiCodeWithSkinColor(checkEmoji.metaData as Emoji, preferredSkinTone);
            emojis.push({
                name,
                code: checkEmoji.metaData?.code,
                types: checkEmoji.metaData.types,
            });

            // If this is the last emoji in the message and it's the end of the message so far,
            // add a space after it so the user can keep typing easily.
            if (i === emojiData.length - 1) {
                emojiReplacement += ' ';
            }

            newText = newText.replace(emojiData[i], emojiReplacement);
        }
    }

    return {text: newText, emojis};
}

/**
 * Find all emojis in a text and replace them with their code.
 */
function replaceAndExtractEmojis(text: string, preferredSkinTone = CONST.EMOJI_DEFAULT_SKIN_TONE, lang = CONST.LOCALES.DEFAULT) {
    const {text: convertedText = '', emojis = []} = replaceEmojis(text, preferredSkinTone, lang);

    return {
        text: convertedText,
        emojis: emojis.concat(extractEmojis(text)),
    };
}

/**
 * Suggest emojis when typing emojis prefix after colon
 * @param [limit] - matching emojis limit
 */
function suggestEmojis(text: string, lang: keyof typeof emojisTrie, limit = CONST.AUTO_COMPLETE_SUGGESTER.MAX_AMOUNT_OF_SUGGESTIONS) {
    const trie = emojisTrie[lang];
    if (!trie) {
        return [];
    }

    const emojiData = text.match(CONST.REGEX.EMOJI_SUGGESTIONS);
    if (!emojiData) {
        return [];
    }

    const matching: Emoji[] = [];
    const nodes = trie.getAllMatchingWords(emojiData[0].toLowerCase().slice(1), limit);
    for (const node of nodes) {
        if (node.metaData.code && !matching.find((obj) => obj.name === node.name)) {
            if (matching.length === limit) {
                return matching;
            }
            matching.push({code: node.metaData?.code ?? '', name: node.name, types: node.metaData.types});
        }
        const suggestions = node.metaData.suggestions;
        if (!suggestions) {
            return;
        }
        for (const suggestion of suggestions) {
            if (matching.length === limit) {
                return matching;
            }

            if (!matching.find((obj) => obj.name === suggestion.name)) {
                matching.push({...suggestion});
            }
        }
    }
    return matching;
}

/**
 * Retrieve preferredSkinTone as Number to prevent legacy 'default' String value
 */
const getPreferredSkinToneIndex = (val: string | number): number | string => {
    if (Number.isInteger(Number(val))) {
        return val;
    }

    return CONST.EMOJI_DEFAULT_SKIN_TONE;
};

/**
 * Given an emoji object it returns the correct emoji code
 * based on the users preferred skin tone.
 */
const getPreferredEmojiCode = (emoji: Emoji, preferredSkinTone: number): string => {
    if (emoji.types) {
        const emojiCodeWithSkinTone = emoji.types[preferredSkinTone];

        // Note: it can happen that preferredSkinTone has a outdated format,
        // so it makes sense to check if we actually got a valid emoji code back
        if (emojiCodeWithSkinTone) {
            return emojiCodeWithSkinTone;
        }
    }

    return emoji.code;
};

/**
 * Given an emoji object and a list of senders it will return an
 * array of emoji codes, that represents all used variations of the
 * emoji.
 * */
const getUniqueEmojiCodes = (emojiAsset: Emoji, users: Array<{skinTones: Array<{skinTone: number; createdAt: string}>}>): string[] => {
    const uniqueEmojiCodes: string[] = [];
    users.forEach((userSkinTones) => {
        userSkinTones.skinTones.forEach(({skinTone}) => {
            const emojiCode = getPreferredEmojiCode(emojiAsset, skinTone);
            if (emojiCode && !uniqueEmojiCodes.includes(emojiCode)) {
                uniqueEmojiCodes.push(emojiCode);
            }
        });
    });
    return uniqueEmojiCodes;
};

export {
    findEmojiByName,
    findEmojiByCode,
    getEmojiName,
    getLocalizedEmojiName,
    getHeaderEmojis,
    mergeEmojisWithFrequentlyUsedEmojis,
    getFrequentlyUsedEmojis,
    containsOnlyEmojis,
    replaceEmojis,
    suggestEmojis,
    trimEmojiUnicode,
    getEmojiCodeWithSkinColor,
    getPreferredSkinToneIndex,
    getPreferredEmojiCode,
    getUniqueEmojiCodes,
    replaceAndExtractEmojis,
};

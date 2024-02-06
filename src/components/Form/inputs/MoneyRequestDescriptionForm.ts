import type {Form} from '@src/types/onyx';

const INPUT_IDS = {
    COMMENT: 'comment',
    MONEY_REQUEST_COMMENT: 'moneyRequestComment',
} as const;

type MoneyRequestDescriptionForm = Form<{
    [INPUT_IDS.COMMENT]: string;
    [INPUT_IDS.MONEY_REQUEST_COMMENT]: string;
}>;

export default MoneyRequestDescriptionForm;
export {INPUT_IDS};

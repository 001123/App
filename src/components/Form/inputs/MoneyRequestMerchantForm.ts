import type {Form} from '@src/types/onyx';

const INPUT_IDS = {
    MERCHANT: 'merchant',
    MONEY_REQUEST_MERCHANT: 'moneyRequestMerchant',
} as const;

type MoneyRequestMerchantForm = Form<{
    [INPUT_IDS.MERCHANT]: string;
    [INPUT_IDS.MONEY_REQUEST_MERCHANT]: string;
}>;

export default MoneyRequestMerchantForm;
export {INPUT_IDS};

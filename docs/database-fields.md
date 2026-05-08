VENDORS TABLE
1. vendor_id
2. business_name
3. owner_name
4. mobile_number
5. email
6. password
7. business_category
8. business_address
9. gst_pan
10. documents
11. status
12. created_at

CUSTOMERS TABLE
1. customer_id
2. customer_name
3. mobile_number
4. city
5. joined_at
6. wallet_balance

OFFERS TABLE
1. offer_id
2. vendor_id
3. offer_title
4. offer_description
5. discount_type
6. discount_value
7. validity_start
8. validity_end
9. terms_conditions
10. wallet_deduction_amount
11. status
12. created_at

WALLETS TABLE
1. wallet_id
2. customer_id
3. balance
4. last_recharge_amount
5. last_recharge_date


COUPONS TABLE
1. coupon_id
2. customer_id
3. vendor_id
4. offer_id
5. coupon_code
6. claim_date
7. redeem_status
8. redeem_date

TRANSACTIONS TABLE
1. transaction_id
2. customer_id
3. type
4. amount
5. payment_status
6. transaction_date


ADMINS TABLE
1. admin_id
2. admin_name
3. email
4. password
5. role
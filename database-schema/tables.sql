Table 1 ADMINS
- admin_id
- admin_name
- email
- password
- role
- created_at

Table 2
VENDORS
- vendor_id
- business_name
- owner_name
- mobile_number
- email
- password
- business_category
- business_address
- gst_pan
- documents
- account_status
- created_at

Table 3 
CUSTOMERS
- customer_id
- customer_name
- mobile_number
- city
- joined_at
- wallet_balance

Table 4 
OFFERS
- offer_id
- vendor_id
- offer_title
- offer_description
- discount_type
- discount_value
- validity_start
- validity_end
- terms_conditions
- wallet_deduction_amount
- offer_status
- created_at

Table 5 
COUPONS
- coupon_id
- customer_id
- vendor_id
- offer_id
- coupon_code
- claim_date
- redeem_status 
- redeem_date

Table 6 
TRANSACTIONS
- transaction_id
- customer_id
- amount
- transaction_type
- payment_status
- transaction_date

Table 7 WALLETS
- wallet_id
- customer_id
- balance
- last_recharge_amount
- last_recharge_date

Table 8 
CATEGORIES
- category_id
- category_name
- category_status

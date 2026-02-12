# ReplyAsOriginalRecipient #

If you use custom email addresses (postfix/qmail/gmail extensions)
such as "john.doe+github@example.com" for each account you create 
or each contact (john.doe@example.com is your email address, +github is 
the extension) then this Thunderbird module is for you!
When you reply to an email addressed to your email address with 
extension, the From: field is replaced by this same address.

This extension looks for email header "x-original-to", if not found then use
address from "to" field if there is only one address.

Replace old (and not compatible) ReplyAsOriginalRecipient extension made by Qiqitori.

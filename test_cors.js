const token = '7985901918:AAFK33yVAEPPKiAbiaMFCdz78TpOhBXeRr0';
fetch(`https://api.telegram.org/bot${token}/getMe`)
    .then(r => r.json())
    .then(console.log)
    .catch(console.error);

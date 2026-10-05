// Well-known throwaway / disposable email domains. Used two ways from this one file:
//  - the signup page rejects them early with a friendly message (browser), and
//  - the server rejects them again when the account is set up (src/lib/trialUse.js), since the
//    browser check alone can be bypassed.
// Not exhaustive — new disposable services appear constantly — it just removes the common ones.
(function (root) {
  const DOMAINS = [
    'mailinator.com','mailinator.net','mailinator2.com','guerrillamail.com','guerrillamail.net','guerrillamail.org','guerrillamail.biz',
    'guerrillamail.de','guerrillamailblock.com','sharklasers.com','grr.la','spam4.me','pokemail.net','10minutemail.com','10minutemail.net',
    '10minutemail.org','10minemail.com','20minutemail.com','tempmail.com','temp-mail.org','temp-mail.io','tempmail.net','tempmail.dev',
    'tempmailo.com','tempinbox.com','tempemail.net','tempr.email','temporary-mail.net','throwawaymail.com','throwam.com','trashmail.com',
    'trashmail.net','trashmail.me','trashmail.de','trash-mail.com','trash-mail.at','yopmail.com','yopmail.net','yopmail.fr','cool.fr.nf',
    'jetable.org','nomail.xl.cx','mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
    'getnada.com','nada.email','nada.ltd','dispostable.com','maildrop.cc','mailnesia.com','mailcatcher.me','mailnull.com','mailtothis.com',
    'fakeinbox.com','fakemail.net','fakemailgenerator.com','emailfake.com','email-fake.com','fake-mail.net','mohmal.com','mohmal.in',
    'emailondeck.com','mytemp.email','mytrashmail.com','mintemail.com','mt2014.com','mt2015.com','spambox.us','spambog.com','spambog.de',
    'spamgourmet.com','spamex.com','spamfree24.org','spamherelots.com','spamhereplease.com','spamthisplease.com','mailmoat.com',
    'mailexpire.com','mailforspam.com','harakirimail.com','incognitomail.com','incognitomail.org','instantemailaddress.com','inboxalias.com',
    'imgof.com','tmailinator.com','tmpmail.net','tmpmail.org','burnermail.io','byom.de','crazymailing.com','deadaddress.com','despam.it',
    'discard.email','discardmail.com','discardmail.de','dropmail.me','e4ward.com','easytrashmail.com','einrot.com','emailsensei.com',
    'emailtemporanea.com','emailtemporanea.net','emltmp.com','fakeinformation.com','filzmail.com','getairmail.com','girlsundertheinfluence.com',
    'gishpuppy.com','guerrillamail.info','haltospam.com','hidemail.de','hmamail.com','hulapla.de','ieatspam.eu','ieatspam.info',
    'incognitomail.net','jourrapide.com','junk1e.com','kasmail.com','klassmaster.com','koszmail.pl','kurzepost.de','letthemeatspam.com',
    'lifebyfood.com','link2mail.net','litedrop.com','lookugly.com','lortemail.dk','lr78.com','maileater.com','mailfreeonline.com',
    'mailguard.me','mailimate.com','mailin8r.com','mailinater.com','mailme.lv','mailmetrash.com','mailnator.com','mailscrap.com',
    'mailshell.com','mailsiphon.com','mailtemp.info','mailzilla.com','makemetheking.com','meltmail.com','messagebeamer.de','mierdamail.com',
    'moakt.com','moakt.ws','mvrht.net','mx0.wwwnew.eu','my10minutemail.com','nepwk.com','neverbox.com','no-spam.ws','nobulk.com',
    'noclickemail.com','nogmailspam.info','nomail2me.com','nospam.ze.tc','nospamfor.us','nowmymail.com','objectmail.com','obobbo.com',
    'oneoffemail.com','onewaymail.com','online.ms','opayq.com','ordinaryamerican.net','otherinbox.com','owlpic.com','pjjkp.com',
    'plexolan.de','politikerclub.de','poofy.org','proxymail.eu','putthisinyourspamdatabase.com','quickinbox.com','rcpt.at','recode.me',
    'recursor.net','regbypass.com','rmqkr.net','safe-mail.net','safersignup.de','safetymail.info','sandelf.de','sendspamhere.com',
    'sharedmailbox.org','shieldedmail.com','shitmail.me','shortmail.net','sibmail.com','skeefmail.com','slaskpost.se','slopsbox.com',
    'smellfear.com','snakemail.com','sneakemail.com','sofort-mail.de','sogetthis.com','soodonims.com','spamavert.com','spambob.com',
    'spamcero.com','spamcon.org','spamcowboy.com','spamdecoy.net','spamfighter.cf','spamfree.eu','spamgoes.in','spamhole.com',
    'spaml.com','spaml.de','spammotel.com','spamobox.com','spamoff.de','spamslicer.com','spamspot.com','spamstack.net','spamtroll.net',
    'supermailer.jp','suremail.info','tafmail.com','teewars.org','teleworm.com','teleworm.us','thankyou2010.com','thisisnotmyrealemail.com',
    'throwawayemailaddress.com','tilien.com','tmail.ws','tokem.co','toomail.biz','tradermail.info','trbvm.com','trillianpro.com',
    'twinmail.de','tyldd.com','uggsrock.com','upliftnow.com','uplipht.com','venompen.com','veryrealemail.com','viditag.com','viralplays.com',
    'vkcode.ru','vomoto.com','vpn.st','vsimcard.com','vubby.com','wasteland.rfc822.org','webemail.me','webm4il.info','wegwerfadresse.de',
    'wegwerfemail.de','wegwerfmail.de','wegwerfmail.net','wegwerfmail.org','wh4f.org','whyspam.me','willhackforfood.biz','willselfdestruct.com',
    'winemaven.info','wronghead.com','wuzup.net','wuzupmail.net','www.e4ward.com','xagloo.com','xemaps.com','xents.com','xmaily.com',
    'xoxy.net','yep.it','yogamaven.com','yuurok.com','zehnminutenmail.de','zippymail.info','zoaxe.com','zoemail.org','zomg.info',
    'inboxbear.com','mailpoof.com','tempail.com','tempmailaddress.com','tempmailer.com','temp-mail.ru','mail.tm','mailtm.com','1secmail.com',
    '1secmail.net','1secmail.org','esiix.com','wwjmp.com','xojxe.com','yoggm.com','kzccv.com','qiott.com','vjuum.com','laafd.com','dcctb.com',
    'tmpeml.com','tmpbox.net','fexpost.com','fexbox.org','fexbox.ru','mailbox.in.ua','inboxkitten.com','emailnax.com','anonbox.net',
    'getmailet.com','luxusmail.org','linshiyouxiang.net','spambox.org','mail-temporaire.fr','guerrillamail.ch','cuvox.de','dayrep.com',
    'armyspy.com','einrot.de','fleckens.hu','gustr.com','rhyta.com','superrito.com','teleworm.us',
  ];
  const SET = new Set(DOMAINS);
  function isDisposableDomain(domain) {
    if (!domain) return false;
    const d = String(domain).trim().toLowerCase();
    if (SET.has(d)) return true;
    // also catch subdomains of a listed domain (x.mailinator.com)
    const parts = d.split('.');
    for (let i = 1; i < parts.length - 1; i++) if (SET.has(parts.slice(i).join('.'))) return true;
    return false;
  }
  const api = { DISPOSABLE_DOMAINS: DOMAINS, isDisposableDomain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BobDisposable = api;
})(typeof window !== 'undefined' ? window : globalThis);

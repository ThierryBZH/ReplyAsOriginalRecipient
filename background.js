// SPDX-License-Identifier: GPL-3.0-only
(function(tb){
'use strict';
const verbose = 0;


const on_compose_start = async (tab, win)=>{
    // HACK: in some scenarios (draft, mailto, auto-bcc), calling
    // getComposeDetails immediately after tab is created causes some
    // message details to be lost, need to sleep to avoid this
    await sleep(10);
    let msg = await tb.compose.getComposeDetails(tab.id);
    log.info('on_compose_start', json2({
        tab: {id: tab.id, win_id: tab.windowId, url: tab.url,
            status: tab.status},
        win: {id: win.id, type: win.type},
        details: msg,
    }));
		
    // recipients are not always available right away, so need to wait
    if (!is_new(msg))
    {
        let waits = [1, 10, 25, 50, 100, 100, 100, 100]; // total: 486
        for (let i=0; !msg.to.length&&!msg.cc.length && i<waits.length; i++)
        {
            await sleep(waits[i]);
            msg = await tb.compose.getComposeDetails(tab.id);
        }
        log.info('final details', json2(msg));
    }
    
    if (is_reply(msg))
    {
			let oriMsg = await tb.messages.getFull(msg.relatedMessageId);
			let originalTo = null;
			if (oriMsg) {
				log.info('orimessage',json2({headers:oriMsg.headers}));
				originalTo = oriMsg.headers['x-original-to']?oriMsg.headers['x-original-to'][0]:null;
			}
			let identityName = splitAddr(msg.from);
			if (oriMsg && oriMsg.headers['to'].length==1) {
				if(!originalTo){
					originalTo = oriMsg.headers['to'][0];
				} else {
					// Take name from To if not found in OriginalTo
					const [toName, toAddr] = splitAddr(oriMsg.headers['to'][0]);
					if(!identityName[0] && toName !== null && toAddr == originalTo){
						identityName[0] = toName;
					}
				}
			}
			
			if (originalTo) {
				let splitted = 	splitAddr(originalTo);
				if (splitted[0]) identityName[0]=splitted[0];
				if (splitted[1]) identityName[1]=splitted[1];
			}
			const name = (identityName[0]||'').trim();
			const email = (identityName[1]||'').trim();
			originalTo = (name ? name+' ' : '')+'<'+email+'>';
			await tb.compose.setComposeDetails(tab.id, {from: originalTo});
      msg = await tb.compose.getComposeDetails(tab.id);
    }
		
    // HACK: editing CC causes focus to move to CC field, which is not useful.
    // Least bad solution is to fix focus manually to body/to.
    for (let delay of [0, 1, 10, 10])
    {
        if (delay) await sleep(delay);
        await set_compose_focus(tab.id, is_reply(msg)&&'body'
            || !msg.to.length&&'to' || 'body', {msg});
    }
};

const set_compose_focus = async (tab_id, target, opt)=>{
    log.info(`setting compose focus to '${target}'`);
    if (target=='to'||target=='cc'||target=='bcc') {
        let msg = opt&&opt.msg;
        if (!msg)
            msg = await tb.compose.getComposeDetails(tab_id);
        let orig_v = msg[target];
        await tb.compose.setComposeDetails(tab_id, {[target]: [...orig_v, 'x']});
        await tb.compose.setComposeDetails(tab_id, {[target]: orig_v});
    } else if (target=='body') {
        await tb.tabs.executeScript(tab_id, {code: 'window.focus()'});
    } else {
        throw new Error('Invalid focus target: '+target);
    }
};

// type field was added in thunderbird 88
// before, we check for "Re: " prefix in subject to detect
const is_reply = msg=>{
    if (msg.type)
        return msg.type=='reply';
    return (msg.subject||'').startsWith('Re: ');
};

const is_new = msg=>{
    if (msg.type)
        return msg.type=='new';
    return !msg.subject;
}

const splitAddr = addr=> {
	var lIoLower = addr.lastIndexOf('<');
	var lIoGreater = addr.lastIndexOf('>');

	var fullName = null, emailAddr = null;
	if (lIoLower==-1) {
		if (addr.lastIndexOf('@')!=-1) {
			emailAddr = addr.trim();
		}
	} else if (lIoLower<lIoGreater) {
		emailAddr = addr.substring(lIoLower+1,lIoGreater);
		fullName = addr.substring(0,lIoLower).trim();
	}

	return [fullName,emailAddr];
}


tb.tabs.onCreated.addListener(tab=>{
    log.trace('tabs.onCreated', tab);
    let win = tb.windows.get(tab.windowId);
    if (win && win.type=='messageCompose')
        on_compose_start(tab, win);
});

tb.tabs.onUpdated.addListener((tab_id, changes, tab)=>{
    log.trace('tabs.onUpdated', {tab_id, changes, tab});
});

tb.windows.onCreated.addListener(async win=>{
    if (win.type!='messageCompose')
        return;
    let win_tabs = await tb.tabs.query({windowId: win.id});
    log.trace('win_tabs', win_tabs);
    if (win_tabs.length)
    {
        if (win_tabs.length>1)
            log.warn('compose window has multiple tabs:', tabs);
        on_compose_start(win_tabs[win_tabs.length-1], win);
    }
});

// -- utils --

const sleep = ms=>new Promise(resolve=>setTimeout(()=>resolve(), ms));

const json2 = v=>JSON.stringify(v, null, 2);
const json0 = v=>JSON.stringify(v);

const log = (conf, ...args)=>{
    if (typeof conf=='string')
        conf = {cfn: conf};
    if (conf.verbose && verbose<conf.verbose)
        return;
    console[conf.cfn||'log'](...args);
};
log.error = log.bind(log, {cfn: 'error'});
log.warn = log.bind(log, {cfn: 'warn'});
log.info = log.bind(log, {cfn: 'log', verbose: 1});
log.debug = log.bind(log, {cfn: 'debug', verbose: 2});
log.trace = log.bind(log, {cfn: 'debug', verbose: 3});

})(messenger);

let log=console.log;

function clearString(str) {
	return str.length < 12 ? str : (' ' + str).slice(1);
}

let rps = 0;
if (0) setInterval(e=>{
	if (rps >= 10) log('RPS:',rps);
	rps -= 10;
	if (rps < 0) rps = 0;
},1000);


function getURL(url,callback, on_fail) {
	//console.log('URL:',url);
	let xhr = new XMLHttpRequest();
	xhr.timeout = 13000;
	xhr.onreadystatechange = function() {
		if (this.readyState == 4) {
			//console.log('success');
			if (this.status != 200) {
				console.log("error", this.status);
				if (on_fail) on_fail();
				return;
			}
			//window[back] = xhr.responseText;
			if(callback)callback(xhr.responseText);
		}
	};
	//xhr.ontimeout = function() {
		//console.log('timeout');
	//}
	xhr.open("GET", url, true);
	xhr.send(); rps++;
}

let leadingZero = function(num) {
	let s = "0" + num;
	if (s.length > 2) return num;
	return s;
}
let logg = function() { //Выводим лог с меткой времени.
	let dt = new Date();
	log(dt.getHours()+':'+leadingZero(dt.getMinutes())+':'+leadingZero(dt.getSeconds()),...arguments);
}

const DAY_TIME = 24*60*60*1000;

const db_clean_steps = [7, 3, 2, 1, 0.5, 0.2];
function clean_db(timeout_days) {
	const timeout = timeout_days * DAY_TIME;
	//remove pending status
	for(let id in db.user) {
		if (!db.user[id]) {
			delete db.user[id];
			continue;
		}
		delete db.user[id].solutions_pending;
		delete db.user[id].karma_pending;
	}
	//remove users
	let now = (new Date()).getTime();
	for(let id in db.user) {
		let user = db.user[id];
		if (!(now - user.update_time < timeout)) delete db.user[id]; // n days
	}
	//remove questions
	for(let id in db.question) {
		if (tracker_q_ids[id]) continue;
		let q = db.question[id];
		//ignore subscribtions
		if (q.sub) {
			if (!(now - q.ut < 400 * 24 * 60 * 60000)) delete db.question[id]; // 1 year
			continue;
		}
		//ut means update_time
		if (!(now - q.ut < timeout)) delete db.question[id]; // n days
	}
}
function clean_db_users() {
	db.user = {};
}


const MAX_DB_TIMEOUT = 60000;
let saveDB_timer;
let db_saved_called;
function saveDB(no_pause) {
	let now = (new Date()).getTime();
	db_saved_called = db_saved_called || now;
	if (saveDB_timer !== undefined) clearTimeout(saveDB_timer);
	function saveDB_Now() {
		//let check1 = performance.now();
		for(let i=0;i<db_clean_steps.length;i++) {
			clean_db(db_clean_steps[i]);
			try {
				localStorage.db = JSON.stringify(db);
				break;
			} catch(e) {
				console.log("Can't save DB");
			}
		}
		db_saved_called = undefined;
		//let check2 = performance.now();
		//console.log('DB_SAVED!',(check2-check1)+'мс');
	}
	if ((now - db_saved_called > MAX_DB_TIMEOUT)||no_pause) saveDB_Now();
	else saveDB_timer = setTimeout(saveDB_Now,15000);
}

const C_MONTHS = {
	['января']: 'Jan', ['февраля']: 'Feb', ['марта']: 'Mar', ['апреля']: 'Apr',
	['мая']: 'May', ['июня']: 'Jun', ['июля']: 'Jul', ['августа']: 'Aug',
	['сентября']: 'Sep', ['октября']: 'Oct', ['ноября']: 'Nov', ['декабря']: 'Dec',
}

if (localStorage.cut_karma === undefined) localStorage.cut_karma = 1;
//
function updateUser(nickname,timeout) {
	//console.log('update:',nickname);
	if (!nickname) return console.log('No nickname!'); //impossible
	let user = db.user[nickname];
	if (!user) user = db.user[nickname] = {}; //impossible
	user.nickname = nickname;
	let now = (new Date()).getTime();
	let need_update = false;
	if (!(now - user.update_time < (timeout || 24*60*60*1000))) {
		need_update = true;
		user.update_time = now; //error. not updated yet.
	}
	//questions
	if (need_update || user.solutions === undefined && !user.solutions_pending) {
		user.solutions_pending = true;
		saveDB();
		let old_perc_sol_marks = localStorage.old_perc_sol_marks === '1';
		getURL('https://qna.habr.com/user/'+nickname+'/questions',(text)=>{ //log('User:',nickname);
			delete user.solutions_pending;
			//solutions
			//let r = /\s*(\d+)\s{8}<\/div>/g; //todo: very very bad, need better algorytm!
			let r = /<li class="content-list__item" role="content-list_item"([\s\S]*?)<\/div>\s*<\/li>/g;
			let a;
			let sum = 0, cnt = 0, score = 0; //кол-во нормальных вопросов, кол-во решений, сумма очков
			while ((a = r.exec(text)) !== null) {
				let t = a[1];
				//вопросы без ответов не учитываются
				let sol = t.match(/\s*(\d+)\s{8}<\/div>/);
				if (!sol) { log('user parse error',nickname,t); break; }
				if (sol[1] === '0') continue;
				//решения считаем как 1 очко
				let is_sol = t.match(/icon_svg icon_check/);
				if (is_sol) { sum++; cnt++; score++; continue; }
				//сегодняшние вопросы не учитываются
				let tm = t.match(/\s*(.*?)\s*<\/time>/);
				if (!tm) { log('user parse error',nickname,t); break; }
				if (tm[1] == 'только что' || tm[1].indexOf('минут') !== -1 || tm[1].indexOf('час') !== -1) continue;
				sum++;
				//проверка сложности. Простые +0, Средние +0.25, Сложные +0.5 очков.
				let complex = old_perc_sol_marks ? 0 : t.match(/<span class="question__complexity-text">\s*(.*?)\s*<\/span>/);
				if (complex) { complex = complex[1] === 'Средний' ? 0.25 : complex[1] === 'Сложный' ? 0.5 : 0; }
				else complex = 0; //log('complex',complex);
				score += complex;
			}
			freeRegExp(); //log('sum=',sum);
			if (!sum) user.solutions = '-1'; //impossible
			else {
				if (cnt < 4) {
					if (cnt == 0) score = 0;
					else {
						let koef = cnt == 1 ? 0.5 : cnt == 2 ? 0.75 : 0.9; //максимальный понижающий коэффициент для доп. очков
						let max = 20 - cnt; //максимально свободных вопросов
						let free = sum - cnt; //свободные вопросы
						koef = (max - free) / max * (1 - koef) + koef; //корректируем коэффициент от количества свободных вопросов (1 .. 0.75 для 2 решений).
						score = cnt + (score - cnt) * koef; //корректируем довесок очков.
					}
				}
				user.solutions = Math.floor( score / sum * 100 + 0.5); //log(user.solutions+'%', cnt, sum)
			}
			//stats
			a = text.match(/<a href="\/help\/rating" class="mini-counter__rating">[\s\S]*?(\d+)[\s]*<\/a>[\s\S]*?<li class="inline-list__item inline-list__item_bordered">[\s\S]*?<meta itemprop="interactionCount"[\s\S]*?<div class="mini-counter__count">(\d+)[\s\S]*?<div class="mini-counter__count">(\d+)[\s\S]*?<div class="mini-counter__count mini-counter__count-solutions">(\d+)/);
			if (a) {
				let contribution = a[1]-0; //вклад
				if (contribution > 0) user.con = contribution;
				user.cnt_q = a[2]-0; //questions
				user.cnt_a = a[3]-0; //answers
				user.cnt_s = a[4]-0; //perc solutions
			} else console.log("Stats not found, user:",nickname);
		});
	}
	//karma & stats from habr
	if (need_update || user.karma === undefined && !user.karma_pending) {
		user.karma_pending = true;
		saveDB();
		getURL('https://habr.com/users/'+nickname+'/',(text)=>{
			delete user.karma_pending;
			let a = text.match(/<div class="stacked-counter__value[^>]*>(.*)<\/div>\s*<div class="stacked-counter__label">Карма<\/div>/);
			if (a) {
				user.karma = a[1].replace(',','.').replace('–','-');
				let karma = parseFloat(user.karma);
				if (!isNaN(karma)) { // !!!
					if (localStorage.cut_karma == 1) karma = Math.floor(karma);
					user.karma = karma;
				}	else {
					console.log('Ошибка кармы:',nickname,user.karma);
					user.karma = clearString(user.karma);
				}
			} else {
				user.karma = "read-only";
				//console.log('Karma not found, user:',nickname);
			}
			a = text.match(/<span class="tabs-menu__item-counter tabs-menu__item-counter_total" title="Публикации: (\d+)">/);
			if (a) {
				user.stat_pub = parseInt(a[1]);
			}
			a = text.match(/<span class="tabs-menu__item-counter tabs-menu__item-counter_total" title="Комментарии: (\d+)">/);
			if (a) {
				user.stat_comment = parseInt(a[1]);
			}
			a = text.match(/Зарегистрирован<\/span>[\s\n]*<span class="defination-list__value">(.*?)<\/span>/);
			if (a) {
				//console.log('Time:',a[1]);
				let date_str = a[1].replace(' г.','');
				for(let k in C_MONTHS) if (date_str.indexOf(k) !== -1) {
					//console.log('found',date_str.indexOf(k));
					date_str = date_str.replace(k, C_MONTHS[k]);
					break;
				}
				let date = Date.parse(date_str);
				if (!date) console.log('Error parsing date:',clearString(a[1]),date_str);
				else {
					user.reg = Math.floor(date / 1000);
				}
			}
		}, ()=>{ //todo: такой статус нужен лишь при ответе 404
			delete user.karma_pending; user.karma = 'n';
		});
	}
}

function parseTags(txt) {
	let tags = {};
	let r = /<a href="https?:\/\/qna\.habr\.com\/tag\/([^">]*)">\s*([\S ]+?)\s*<\/a>/g
	let a = r.exec(txt);
	while (a) {
		tags[clearString(a[1])] = clearString(a[2]);
		a = r.exec(txt);
	}
	return tags;
}

//todo: удалить tracker_q_ids
function analyzeQuestion(question_id, now, is_fresh) { //logg('Analize!')
	if (question_id<10) return console.log("q_id too low:",question_id); //throw "q_id too low: "+question_id;
	let add_e = !is_fresh ? '?e='+Math.floor(Math.random()*6566811 + 1000000) : '';
	if (!now) now = (new Date()).getTime();
	let q = {is_pending:true, ut:now, cnt_a:0};
	let qq = db.question[question_id];
	if (qq) {
		if(qq.cnt_a) q.cnt_a = qq.cnt_a;
		//q.user_id = db.question[question_id].user_id;
	}
	db.question[question_id] = q;
	saveDB();
	getURL('https://qna.habr.com/q/' + question_id + add_e, function(text) {
		//get title
		const index_title_str = '<h1 class="question__title" itemprop="name ">';
		let index_title = text.indexOf(index_title_str);
		if (index_title > -1) {
			let index_title2 = text.indexOf("</h1>\n",index_title);
			let txt = text.substring(index_title + index_title_str.length + 1, index_title2).trim();
			if (txt) q.t = clearString(txt); //title!
		}
		//logg('Analized',q.t);
		//get user name
		let index_name = text.indexOf('<meta itemprop="name" content="');
		if (index_name > -1) {
			let index_name2 = text.indexOf('</span>', index_name);
			let txt = text.substr(index_name, index_name2 - index_name);
			let m = txt.match(/<meta itemprop=\"name\" content=\"([^"]*)\">/);
			let user_name = m && m[1] || '???';
			//console.log('user_name',user_name);
			m = txt.match(/<meta itemprop=\"alternateName\" content=\"([^"]*)\">/);
			let user_nickname = m && m[1];
			//console.log('user_nickname',user_nickname);
			if (user_nickname) {
				user_nickname=clearString(user_nickname);
				delete q.is_pending;
				q.user_id = user_nickname;
				let user = db.user[user_nickname];
				if (!user) user = db.user[user_nickname] = {};
				user.name = clearString(user_name);
				user.nickname = user_nickname;
				updateUser(user_nickname);
			}
		}
		//get question tags
		let index_tags = text.indexOf('<ul class="tags-list">');
		if (index_tags > -1) {
			let index_tags2 = text.indexOf('</ul>', index_tags || 0);
			let txt = text.substr(index_tags, index_tags2 - index_tags);
			q.tags = parseTags(txt);
		}
		//check subscribtions
		if (text.indexOf('"btn btn_subscribe btn_active"') > -1) q.sb = 1;
		else {
			delete q.sb;
		}
		//count answers
		if(localStorage.check_online==1 && localStorage.is_widget==1 && localStorage.enable_notify_action==1 && localStorage.enable_notifications==1){
			q.cnt_a = (text.match(/class="answer__text/g)||[]).length;
			let r_desc = /<a class="user-summary__avatar"/g;
			let r_img = /(?:<img src="https:\/\/habrastorage\.org\/([^"]+)"|<(svg) class)/g;
			let r_name = /<meta itemprop="alternateName" content="([^"]*)">/g;
			let r_time = /(?:(.*?)<\/time>|<textarea )/g;
			let m;
			let u = {};
			while (m=r_desc.exec(text)) {
				r_img.lastIndex = r_desc.lastIndex;
				if(!(m=r_img.exec(text))) {console.log('Error in img'); break;}
				let o={};
				if(m[1])o.img=clearString(m[1]);
				r_name.lastIndex = r_img.lastIndex;
				if(!(m=r_name.exec(text))) {console.log('Error in name'); break;}
				let nick = clearString(m[1]);
				o.nick=nick;
				r_time.lastIndex = r_name.lastIndex;
				if(!(m=r_time.exec(text))) {console.log('Error in time'); break;}
				if(!m[1]) continue; //нашли textarea
				o.time = getFreshTime(m[1].trim());
				if(o.time>90)continue; //старики не нужны
				if(!u[nick] || u[nick]&&u[nick].time>o.time)u[nick]=o;
			}
			for(let n in u){
				//console.log('user:',u[n]);
				onlineUserUpdate(n,now,u[n].img,u[n].time);
			}
		}
		//check all users
		
	}, e=>{
		//log('ERROR:', xhr.status);
		delete q.is_pending;
	} );
	return q;
}

let db;
function reset_db() {
	db = {
		user:{}, // user_id => { name: name, nickname: nickname, ... }
		question:{}, // q_id => { is_pending:bool, user_id:string, ut:integer }
	};
}
reset_db();

function load_db() {
	try {
		db = JSON.parse(localStorage.db);
	} catch(e) {
		//
	}
}
if (localStorage.save_form_to_storage) { //last added option (reset on each update)
	load_db();
}

let outer_tag = ()=>{};

var condition_error_string;
//Prepare environment and call eval()
function checkCondition(cond, current_data) {
	condition_error_string = '';
	//Special function triggered from eval() - check if a question has the tag
	outer_tag = function(s) {
		let tag_lower = s.toLowerCase();
		let tags = current_data.q.tags;
		if (!tags) return false;
		for(let k in tags) {
			if (tags[k].toLowerCase() == tag_lower) return true;
		}
		return false;
	}
	//Environment
	let env;
	if (current_data.u) {
		let u = current_data.u;
		let q = current_data.q;
		env = {
			questions: u.cnt_q == undefined ? 999 : u.cnt_q,
			answers: u.cnt_a == undefined ? 999 : u.cnt_a,
			solutions: u.solutions == undefined ? 101 : u.solutions,
			karma: u.karma == undefined ? 0 : u.karma,
			comments: u.stat_comment == undefined ? 0 : u.stat_comment,
			articles: u.stat_pub == undefined ? 0 : u.stat_pub,
			nickname: u.nickname || '',
			title: q.t || '', //текст вопроса
			views: q.v == undefined ? 0 : q.v,
			honor: q.con == undefined ? -1 : q.con,
		}
		env.q = env.questions;
		env.a = env.answers;
		env.s = env.solutions;
		env.k = env.karma;
		env.c = env.comments;
		env.publications = env.articles;
		env.p = env.publications;
		env.nick = env.nickname;
		env.n = env.nick;
		env.t = env.title;
		env.v = env.views;
		env.h = env.honor;
		env.respect = env.a && env.h != -1 && Math.round(env.h / env.a * 10) * 0.1 || -1;
		env.r = env.respect;
	} else env = current_data;
	try {
		return eval_lite(cond, env);
	} catch(e) {
		if ((typeof e == 'object') && (typeof e.message == 'string')) condition_error_string = e.message;
		else condition_error_string = e + '';
		return false;
	}
}

function makeInfo(now) {
	now = now || (new Date()).getTime();
	let info = {}; //всякая разна инфа. Например, кеш страницы.
	if (now - cache_page_1_tm < 30000) {
		info.cache_page_1_tm = cache_page_1_tm;
		info.cache_page_1 = cache_page_1;
	}
	if (now - cache_my_feed_tm < 30000) {
		info.cache_my_feed_tm = cache_my_feed_tm;
		info.cache_my_feed = cache_my_feed;
	}
	if (localStorage.check_online == 1 && save_current_user && localStorage.is_widget==1
		&& localStorage.enable_notify_action==1 && localStorage.enable_notifications==1)
	{
		info.users = onlineUsersArr();
		if(now-last_check_online > 50000) {
			info.need_check=1;
			last_check_online=now;
		}
		if(now-last_vote_online > 60000 && online_like && save_current_user) {
			if(online_like[save_current_user]) info.need_vote=2;
			else info.need_vote=1;
			last_vote_online=now;
		}
	}
	return info;
}

let online = {}, last_check_online=0, online_like,last_vote_online=0;
function onlineUserUpdate(nick,now,img,tm){ //console.log('+nick',nick,tm);
	tm=tm||0;
	online[nick]=online[nick]||{};
	online[nick].ut=now-tm*60000;
	if(img){
		online[nick].img=img;
		if(db.user[nick])db.user[nick].img = img;
	}
	if(!online[nick].img && db.user[nick] && db.user[nick].img){
		online[nick].img = db.user[nick].img;
	}
}
function onlineClean(){
	let now = (new Date()).getTime();
	for(let nick in online){
		if (now - online[nick].ut > 7 * 60000) delete online[nick];
	}
}
let last_onl=0;
function onlineUsersArr(){
	onlineClean();
	let users=[];
	for(let nick in online){
		let o = online[nick];
		users.push({
			nick:nick,
			img:o.img,
			ut:o.ut,
		});
	}
	users.sort((a,b) => (a.ut > b.ut) ? -1 : ((b.ut > a.ut) ? 1 : 0));
	//if (last_onl!=users.length){
		//console.log(users);
		//last_onl=users.length;
	//}
	return users;
}

//Кэш тегов, которые интересны пользователю. Живет до перезагрузки, но не более суток.
let userTagsCache = {}; 
function updateUserTagsCache(nick) {
	let cache = userTagsCache[nick];
	if (!cache) {
		cache = {ut:0, data:{cnt:-1}};
		userTagsCache[nick] = cache;
	}
	if (cache.is_pending) return;
	cache.is_pending = true;
	let data = cache.data;
	getURL('https://qna.habr.com/user/'+nick+'/tags', html=>{ //console.log('onSuccess');
		cache.is_pending = false;
		cache.ut = (new Date()).getTime();
		let html_cards = html.match(/<article class="card"[\s\S]*?<\/article>/g);
		if (!html_cards) {
			data.cnt = 0;
			data.tags = [];
			return;
		}
		//Фасуем теги
		let tags = [];
		html_cards.forEach(h=>{
			//<a class="card__head-image card__head-image_tag" href="https://qna.habr.com/tag/тестирование-по">
      //        <img class="tag__image tag__image_bg" src="https://habrastorage.org/r/w120/files/4d0/738/fc1/4d0738fc1d9b4e0b8818bea5ac8a4923.png" alt="тестирование-по">
      //</a>
			let m = h.match(/<meta itemprop="name" content="([^"]*)">[\s\S]*?<meta itemprop="interactionCount" content="(\d+) answers">[\s\S]*?<meta itemprop="interactionCount" content="(\d+) contribute">/);
			if(!m)return; //console.log("Can't read tag card:",{s:h});
			let tag = {
				name: clearString(m[1]),
				cnt_a: m[2]-0,
				honor: m[3]-0,
			};
			if (tag.honor === 0) return;
			tags.push(tag);
		});
		//console.log('tags.length =',tags.length);
		//Отбираем значимые теги. Это те, которые до крутого излома.
		let ratio = [];
		for(let i=0;i<tags.length-2;i++){
			let tag1 = tags[i];
			let tag2 = tags[i+1];
			ratio[i] = (tag1.honor / tag2.honor) * ((i+2) / (i+3));
		}
		//Поправки на ветер.
		let maxtag = Math.min(tags.length-1, 5);
		for(let i=maxtag-1; i>=0; i--) {
			if (ratio[i] > ratio[maxtag]) maxtag = i;
		}
		//console.log(maxtag,ratio);
		//if (maxtag < 0) tags=[];
		//else tags.splice(maxtag+1);
		data.tags = tags;
		data.cnt = maxtag+1; //tags.length;
	}, ()=>{ //console.log('onFail');
		cache.is_pending = false;
	});
}

let c_kick_truba;
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if(!db) reset_db(); //imppossible. for debugging
	if (request.type == "getQuestions") {
		let a = {};
		let now = (new Date()).getTime();
		//console.log('getQuestions:',request.arr);
		request.arr.forEach(data=>{
			let q_id = data.id-0;
			let question = db.question[q_id];
			if (question) {
				question.ut = now;
				if (data.v) question.v = data.v-0;
				let user_id = question.user_id;
				let user = user_id && db.user[user_id];
				let tags = question.tags;
				if (tags) {
					for(let k in tags) {
						if (db_tags_blacklist[tags[k].toLowerCase()]) {
							a[q_id] = {hide:true, q:question};
							if (user) a[q_id].u = user;
							return;
						}
					}
				}
				if (user) {
					let current_data = {q:question, u:user};
					a[q_id] = current_data;
					updateUser(user_id);
					//Проверка доп. условий
					for(let i=0;i<db_conditions.length;i++){
						let rule = db_conditions[i];
						if (checkCondition(rule.cond, current_data)) {
							if (rule.act == 'hide') current_data.hide = true;
							else if (rule.act == 'notify') continue; //при раскраске нам это не нужно
							else current_data.color = rule.act;
							break;
						}
					}
				}
				else if (!question.is_pending) analyzeQuestion(q_id, now);
			}
			else {
				question = analyzeQuestion(q_id, now);
				if (data.v) question.v = data.v-0;
			}
		});
		sendResponse(a);
	} else if (request.type == "analyzeUserTags") {
		let data = userTagsCache[request.nickname];
		if (data && data.ut + DAY_TIME > (new Date()).getTime() ) data = data.data;
		else {
			updateUserTagsCache(request.nickname);
			data = {cnt:-1};
		}
		sendResponse(data);
	} else if (request.type == "getInfo") {
		sendResponse(makeInfo());
	} else if (request.type == "getHints") {
		let data = {}
		request.nicknames.forEach(n=>{
			if (CHARACTERS[n]) data[n]=CHARACTERS[n];
		});
		sendResponse(data);
	} else if (request.type == "getUsers") {
		let is_hint = localStorage.show_psycho == 1;
		let u = {};
		//console.log('getUsers',request.arr);
		for(let nickname in request.arr) {
			if (db_user_blacklist[nickname]) {
				u[nickname] = {ban:1};
				continue;
			}
			let user = db.user[nickname];
			if (user) {
				user = Object.assign({},user);
				if (is_hint && CHARACTERS[nickname]) {
					user = Object.assign({},user,CHARACTERS[nickname]);
				}
				let is_achiever = user.cnt_s > 49 && user.cnt_a > 9 && !NOT_ACHIEVERS[nickname] || ACHIEVERS[nickname];
				if (is_achiever && localStorage.show_status_achiever == 1 && !(user.hint && localStorage.show_psycho_over_achiever == 1)) {
					if (ACHIEVERS[nickname]) is_achiever = 3;
					else if (user.cnt_s > 89) is_achiever = 2;
					else is_achiever = 1;
					user.ach = is_achiever;
				}
				u[nickname] = user;
				//user.respect = user.cnt_a && Math.round(user.con / user.cnt_a * 10) * 0.1 || 0;
			}
			if (request.arr[nickname] === 1) { //Принудительное обновление, если 1, а не просто true.
				//console.log('Fast update:',nickname);
				updateUser(nickname, 300000);
			}
			else updateUser(nickname);
		}
		sendResponse(u);
	} else if (request.type == "getOptions") {
		let now = (new Date()).getTime();
		let options = {};
		if (!versionUpdated) updateVersion();
		if (now - versionUpdated < 86400000 && localStorage.is_widget) options.is_new=true;
		let q = request.q;
		if (q) {
			if (tracker_q_ids[q.id]) delete tracker_q_ids[q.id];
		}
		TOSTER_OPTIONS.forEach((opt)=>{
			options[opt] = parseFloat(localStorage[opt]) || 0;
		});
		if(options.check_online){
			options.check_online = localStorage.enable_notify_action==1 && options.enable_notifications && options.is_widget;
		}
		sendResponse(options);
	} else if (request.type == "getOptionsHabr") {
		let options = {};
		HABR_OPTIONS.forEach((opt)=>{
			options[opt] = parseInt(localStorage[opt]);
		});
		if (localStorage.habr_fix_lines == 1) {
			options.habr_css = habr_css_fix_lines;
		}
		sendResponse(options);
	} else if (request.type == "getNotifications") {
		let is_active = request.active;
		let now = (new Date()).getTime();
		if (is_active && localStorage.notify_if_inactive==1) notifications_pause = now;
		let el_hash = {	hash:events_list_navbar_hash };
		let info = makeInfo(now); //всякая разна инфа. Например, кеш страницы.
		if (now - notifications_pause < 30000) { //Выдерживаем паузу.
			sendResponse({1:el_hash,2:info}); //Но не обнуляем
			return;
		}
		if (now - tm_browser_load < 40000) { //После загрузки расширения не паникуем, не спамим, молчим.
			arr_notifications = {}; //Сливаем все уведомления в трубу.
			if (c_kick_truba===undefined) {
				c_kick_truba=false;
				console.log('Уведомления временно отключены');
			}
		} else if(!c_kick_truba) {
			c_kick_truba = true;
			console.log('Уведомления включены');
		}
		
		getNotifications_last_time = now;
		for(q_id in arr_notifications) { //Чистим от старых
			let item = arr_notifications[q_id];
			if (now - item.tm > 30000) {
				console.log('Удаляем по таймауту',now,arr_notifications[q_id]);
				delete arr_notifications[q_id];
			}
		}
		//console.log('Отправляем уведомления:',Object.keys(arr_notifications).length);
		arr_notifications[1] = el_hash;
		arr_notifications[2] = info;
		sendResponse(arr_notifications);
		arr_notifications = {};
	} else if (request.type == "checkOnline") { //get info from page
		let now = (new Date()).getTime();
		last_check_online = now;
		let obj = request.obj;
		if (online_like) { //compare
			for(let nick in online_like) {
				if(obj[nick]){ //удаляем, кто совпал
					//delete obj[nick];
					//online_like[nick].ut = now;
				} else { //удалился
					onlineUserUpdate(nick,now,online_like[nick].img);
				}
			}
			for(let nick in obj) {
				if(online_like[nick]); //online_like[nick].ut = now;
				else onlineUserUpdate(nick,now,obj[nick].img);
			}
		}
		online_like = obj;
		sendResponse();
	} else if (request.type == "disableNotifications") {
		localStorage.enable_notifications = 0;
	} else if (request.type == "updateIconNum") {
		if (request.hash != events_list_navbar_hash) {
			events_list_navbar_hash = request.hash;
			events_list_navbar = request.html;
			//console.log('Новый хеш от страницы:',request.hash,request.html);
		}
		chrome.browserAction.setBadgeText({text:""+request.cnt});
	} else if (request.type == "getSubStatus") {
		let qnum = request.qnum;
		let question = db.question[qnum];
		sendResponse(question && !!question.sub);
	} else if (request.type == "setSubStatus") {
		let qnum = request.qnum;
		let question = db.question[qnum];
		if (!question) question = analyzeQuestion(qnum);
		if (question.sub) {
			delete question.sub;
		} else {
			question.sub = 1;
		}
		question.ut = (new Date()).getTime();
		sendResponse(!!question.sub);
		saveDB();
	} else if (request.type == "directQuestionUpdate") {
		if (!request.nickname || !request.q_id) return;
		let q = db.question[request.q_id];
		if (!q) {
			q = {};
			db.question[request.q_id] = q;
		}
		q.user_id = request.nickname;
		if (request.tags_html) q.tags = parseTags(request.tags_html);
		if (request.title) q.t = request.title;
		if (request.sb) q.sb = 1;
		else if (request.sb === false) delete q.sb;
		q.ut = (new Date()).getTime();
	} else if (request.type == "getAside") {
		//console.log('Посылаем хеш:',events_list_navbar_hash,events_list_navbar);
		sendResponse({
			html:events_list_navbar,
			hash:events_list_navbar_hash,
		});
	} else if (request.type == 'clearQuestion') {
		analyzeQuestion(request.q_id, 0, true);
	} else if (request.type == 'Reload') {
		chrome.runtime.reload();
	}
});


const TOSTER_OPTIONS = [
	'swap_buttons', 'hide_sol_button', 'show_habr', 'hide_word_karma',
	'show_name', 'show_nickname', 'hide_offered_services', 'use_ctrl_enter',
	'top24_show_tags', 'top24_show_author', 'hide_solutions', 'save_form_to_storage',
	'make_dark', 'enable_notifications', //'notify_if_inactive',
	//'always_notify_my_questions', 'notify_about_likes', 'notify_about_solutions',
	'datetime_replace', 'datetime_days', 'show_blue_circle', 'notify_all',
	'aside_right_noads', 'aside_right_hide',
	'show_my_questions', 'show_my_answers', 'minify_curator', 'remove_te_spam',
	'is_widget', 'top24_show', 'check_online', 'is_search', 'is_options_button', 'is_debug',
	'minify_names', 'read_q',
	'show_my_comments','show_my_likes','show_my_tags',
	'hidemenu_all_tags','hidemenu_all_users','hidemenu_all_notifications',
	//'show_psycho', //local
	'psycho_replace', 'psycho_not_myself', 'achiever_replace',
	'psycho_hide_comments', 'psycho_hide_same_author','achiever_hide_comments','achiever_hide_same_author','achiever_hide_next','psycho_hide_next',
	'show_cnt_questions','show_cnt_answers','show_perc_solutions','show_perc_sol_marks',
	'show_ban_info','dont_ban_solutions',
	'show_psycho','show_honor','sol_honor_replace','psycho_summary','psycho_tags',
	'mark_anwers_by_color','mark_answers_count',
	'add_comment_lines','change_user_background','show_respect',
	'show_user_reg_date','short_tags','show_rules','show_user_reg_toster','show_user_reg_min',
];

const HABR_OPTIONS = [
	'move_posttime_down','move_stats_up', 'hide_comment_form_by_default',
];

if (localStorage.show_ban_info === undefined) { //last added option
	const options_to_init = [
		//Toster options
		'show_habr','show_nickname','fixed_a_bug','always_notify_my_questions','show_blue_circle','notify_mention','notify_expert',
		'is_widget','is_options_button','is_search','top24_show','read_q','show_psycho','show_status_achiever','show_cnt_questions',
		'show_cnt_answers','show_perc_solutions','show_perc_sol_marks','show_ban_info','psycho_summary',
		'show_rules',
		//Habr options
		//move_posttime_down, move_stats_up, hide_comment_form_by_default, habr_fix_lines
	];
	options_to_init.forEach(c=>{if (localStorage[c] === undefined) localStorage[c]=1});
	if (localStorage.all_conditions === undefined) localStorage.all_conditions="tag('JavaScript') = #ffc";
	if (localStorage.datetime_days === undefined) localStorage.datetime_days=1;
	
}

//--------- DEBUG ---------

function count_obj(obj) {
	let cnt = 0;
	for(let k in obj) cnt++;
	return cnt;
}

// -------------- BLACKLIST TAGS -----------

let db_tags_blacklist = {} // [tag] = true
function update_blacklist() {
	db_tags_blacklist = {};
	const lines = localStorage.tag_blacklist.split("\n");
	for(let i=0;i<lines.length;i++) {
		let line = lines[i];
		if (line.indexOf('//') !== -1) line = line.substr(0,line.indexOf('//'));
		line = line.trim();
		if (!line) continue;
		const tags = line.replace(';',',').split(',');
		tags.forEach(tag=>{
			tag=tag.trim();
			if (!tag) return;
			db_tags_blacklist[tag.toLowerCase()] = true;
		});
	}
}
if (localStorage.tag_blacklist) update_blacklist();

// ----------- USER BLACK LIST ---------

let db_user_blacklist = {}; // [user] = 'rule',
function update_user_blacklist() {
	db_user_blacklist = {};
	let j,err;
	const lines = localStorage.user_blacklist.split("\n");
	for(let i=0;i<lines.length;i++) {
		let line = lines[i];
		if (line.indexOf('//') !== -1) line = line.substr(0,line.indexOf('//'));
		line = line.trim();
		if (!line) continue;
		let rule = -1; //hide - правило по умолчанию
		if (false && (j=line.indexOf('=')) > -1) { //сложное правило. TODO: осмыслить, доделать
			rule = line.substr(j+1).trim();
			if (rule == 'hide') rule = -1;
			else if (rule == 'ban') rule = -2;
			else {
				err = 'Line#'+(i+1)+' это не действие - '+rule;
				continue;
			}
			line = line.substr(0,j).trim();
		}
		let phrases = line.split(',');
		phrases.forEach(phrase=>{
			phrase = phrase.trim().replace("\t",' ');
			if (!phrase) return;
			let arr = phrase.split(' ');
			arr.forEach(nick=>{
				nick = nick.trim();
				if (nick[0] == '@') nick=nick.substr(1);
				if (!nick) return;
				db_user_blacklist[nick] = rule;
			});
		});
	}
	if(err)console.log('User Filter List:',err);
}
if (localStorage.user_blacklist) update_user_blacklist();

// ------------ Дополнительные условия показа вопросов -------------


const isValidAction_image = document.createElement("img");
function isValidAction(stringToTest) {
	if (stringToTest === 'hide' || stringToTest === 'notify') return true;
	if (!stringToTest || stringToTest === 'inherit' || stringToTest === 'transparent') return false;

	let image = isValidAction_image;
	image.style.color = "rgb(0, 0, 0)";
	image.style.color = stringToTest;
	if (image.style.color !== "rgb(0, 0, 0)") { return true; }
	image.style.color = "rgb(255, 255, 255)";
	image.style.color = stringToTest;
	return image.style.color !== "rgb(255, 255, 255)";
}

let example_environment = {
	questions: 1, q:1,
	answers: 1, a:1,
	solutions: 100, s:100,
	karma: 0, k:0,
	comments: 0, c:0,
	articles: 0, publications:0, p:0,
	nickname: 'admin', nick:'admin', n:'admin',
	title: 'Toster?', t:'Toster?',
	views: 0, v:0,
}
var cond_update_error_string;
let db_conditions = [];
let db_conditions_hide_cnt = 0;
let db_conditions_notify_cnt = 0;
function getDbCondLength() {
	return db_conditions_notify_cnt;
}
function update_conditions() {
	cond_update_error_string = '';
	db_conditions = [];
	db_conditions_hide_cnt = 0;
	db_conditions_notify_cnt = 0;
	const lines = localStorage.all_conditions.split("\n");
	for(let i=0;i<lines.length;i++) {
		let rule = lines[i].trim(); //Строка, содержащая отдельное правило
		if (rule.indexOf('//') !== -1) rule = rule.split('//')[0].trim();
		if (!rule) {
			//Пустая строка или комментарий
			continue;
		}
		let eq_idx = rule.lastIndexOf('='); //Последний знак "="
		if (eq_idx < 1 || rule[eq_idx-1] == '=') {
			if(!cond_update_error_string) cond_update_error_string = 'Line #'+(i+1)+': '+rule+' не является правилом.';
			continue;
		}
		let rule_cond_str = rule.substring(0,eq_idx).trim(); //Условие правила - eval(rule_cond_str)
		let rule_action_str = rule.substring(eq_idx+1).trim(); //Действие правила - #ff0 или hide
		if (!rule_action_str) {
			if(!cond_update_error_string) cond_update_error_string = 'Line #'+(i+1)+': не задано действие.';
			continue;
		}
		if (rule_action_str.toLowerCase() == 'hide') {
			rule_action_str = 'hide';
			db_conditions_hide_cnt++;
		}
		if (rule_action_str.toLowerCase() == 'notify') {
			rule_action_str = 'notify';
			db_conditions_notify_cnt++;
		}
		if (!isValidAction(rule_action_str)) {
			if(!cond_update_error_string) cond_update_error_string = 'Line #'+(i+1)+': '+rule_action_str+' не является валидным действием.';
			continue;
		}
		db_conditions.push({
			cond: rule_cond_str,
			act: rule_action_str,
		});
		//test condition
		checkCondition(rule_cond_str, example_environment);
		if (condition_error_string && !cond_update_error_string) cond_update_error_string = 'Line #'+(i+1)+': '+condition_error_string;
	}
	if (!cond_update_error_string && db_conditions_notify_cnt && localStorage.enable_notify_action != 1) {
		cond_update_error_string = 'Действите notify отключено в настройках выше.';
	}
	if (!cond_update_error_string) cond_update_error_string = '&nbsp;';
	return db_conditions_notify_cnt;
}
if (localStorage.all_conditions) { //because eval_lite is not defined yet
	let timer = setInterval(e=>{
		if (eval_lite) {
			update_conditions()
			clearInterval(timer);
		}
	},500); 
}

//---------------------Notofocations------------------------

function freeRegExp(){
  /\s*/g.exec("");
}

let notify_feed_arr = {}; //Массив с id вопросов, по которым уже было уведомление
function clearNotifyFeedArr(now) {
	Object.keys(notify_feed_arr).forEach(id=>{
		let q = db.question[id];
		if (!q || now - q.ut > 9900000) delete notify_feed_arr[id];
	});
	localStorage.save_notify_feed_arr = JSON.stringify(notify_feed_arr);
}
if (localStorage.save_notify_feed_arr) notify_feed_arr = JSON.parse(localStorage.save_notify_feed_arr);

const FRESH_TIME = { //только что, минуту назад, 2 минуты назад, 3 минуты назад
	'только что':0,
	'минуту назад':1,
	'2 минуты назад':2,
	'3 минуты назад':3,
	'4 минуты назад':4,
	'5 минут назад':5,
	'6 минут назад':6,
	'7 минут назад':7,
	'8 минут назад':8,
	'9 минут назад':9,
	'10 минут назад':10,
};
function getFreshTime(time_str) {
	return FRESH_TIME[time_str] === undefined ? 99 : FRESH_TIME[time_str];
}

let cache_my_feed, cache_my_feed_tm=0;
function updateNitificationsMyFeed(now) {
	let xhr = new XMLHttpRequest();
	const url = 'https://qna.habr.com/my/feed';
	xhr.open('GET', url, true);
	xhr.send(); rps++;
	xhr.onload = function() {
		if (xhr.status != 200) return;
		if (localStorage.faster_my_feed == 1) {
			let idx1 = xhr.response.indexOf('<div class="page">'); // 18 length
			let idx2 = xhr.response.indexOf('<aside class="column_sidebar">');
			if (idx1>-1 && idx2>-1) {
				cache_my_feed = clearString(xhr.response.substring(idx1+18,idx2));
				cache_my_feed_tm = now;
			}
		}
		function checkQuestion(q_id) {
			//if (tracker_q_ids[q_id]) return;
			if (notify_feed_arr[q_id] || arr_notifications[q_id]) return;
			let q = db.question[q_id];
			if (save_current_user && save_current_user == q.user_id) return;
			if (db_conditions_hide_cnt) { //есть правила
				if (q.is_pending) return;
				let user = q.user_id && db.user[q.user_id];
				if (!user || user.karma_pending || user.solutions_pending) return;
				//Check rules
				let current_data = {
					q:q,
					u:user,
				}
				for(let i=0;i<db_conditions.length;i++) {
					let rule = db_conditions[i];
					if (!checkCondition(rule.cond, current_data)) continue;
					//Сработало условие
					if (rule.act == 'hide') return;
					else break; //Сработал либо цвет, либо правило на уведомление => хороший вопрос.
				}
			}
			//Ни одна блокировка не сработала.
			arr_notifications[q_id] = {
				q_id:q_id,
				title:q.t,
				//e:1,
				w:'Моя лента - новый вопрос',
			}
			notify_feed_arr[q_id]=1;
		}
		let r = /<h2 class="question__title">\s*<a class="question__title-link question__title-link_list" href="https:\/\/qna\.habr\.com\/q\/(\d+)">\s*(.*?)<\/a>[\S\s]*?<time class="question__date[^>]*>\s*(.+)<\/time>[\S\s]*?<span class="question__views-count">\s*(\d+)[\S\s]*?<div class="mini-counter__count[\S\s]*?>\s*(\d+)   \s*<\/div>/g;
		let m;
		let arr=[];
		while (m = r.exec(xhr.response)) {
			let q_id = m[1]-0;
			arr.push(q_id);
			let title = clearString(m[2].trim());
			let date = m[3].trim();
			let views = m[4]-0;
			let answers = m[5]-0;
			if (getFreshTime(date) > 10) continue;
			let q = db.question[q_id];
			if (!q) {
				q = analyzeQuestion(q_id);
				q.t = title;
				setTimeout(()=>{
					checkQuestion(q_id);
				},4500); //fast enough
				continue;
			}
			q.v = views;
			q.ut = now;
			checkQuestion(q_id);
		}
		freeRegExp();
		clearNotifyFeedArr(now);
		//console.log('My feed:',arr);
	}
}

let cache_page_1, cache_page_1_tm=0; //страница и время загрузки
function updateNitificationsFilterAll(now) {
	//if (db_conditions_notify_cnt == 0) return; //Нет правил, нет смысла проверять.
	let xhr = new XMLHttpRequest();
	const url = 'https://qna.habr.com/questions';
	xhr.open('GET', url, true);
	xhr.send(); rps++;
	xhr.onload = function() {
		if (xhr.status != 200) return;
		if (localStorage.faster_page_1 == 1) {
			let idx1 = xhr.response.indexOf('<div class="page">'); // 18 length
			let idx2 = xhr.response.indexOf('<aside class="column_sidebar">');
			if (idx1>-1 && idx2>-1) {
				cache_page_1 = clearString(xhr.response.substring(idx1+18,idx2));
				cache_page_1_tm = now;
			}
		}
		function checkQuestion(q_id) {
			//if (tracker_q_ids[q_id]) return; //В трекере уведомлений. Нельзя заходить.
			if (notify_feed_arr[q_id] || arr_notifications[q_id]) return;
			let q = db.question[q_id];
			if (q.is_pending) return;
			if (save_current_user && save_current_user == q.user_id) return;
			let user = q.user_id && db.user[q.user_id];
			if (!user || user.karma_pending || user.solutions_pending) return;
			//Check rules
			let tags = q.tags;
			if (tags) {
				for(let k in tags) {
					if (db_tags_blacklist[tags[k].toLowerCase()]) return;
				}
			}
			let current_data = {
				q:q,
				u:user,
			}
			for(let i=0;i<db_conditions.length;i++) {
				let rule = db_conditions[i];
				if (!checkCondition(rule.cond, current_data)) continue;
				//Сработало правило
				if (rule.act == 'hide') return; //плохой вопрос
				else if (rule.act != 'notify') continue; //цвета игнорируем
				arr_notifications[q_id] = {
					q_id:q_id,
					title:q.t,
					//e:1,
					w:'Интересный вопрос',
				}
				notify_feed_arr[q_id]=1;
				return;
			}
		}
		let r = /<h2 class="question__title">\s*<a class="question__title-link question__title-link_list" href="https:\/\/qna\.habr\.com\/q\/(\d+)">\s*(.*?)<\/a>[\S\s]*?<time class="question__date[^>]*>\s*(.+)<\/time>[\S\s]*?<span class="question__views-count">\s*(\d+)[\S\s]*?<div class="mini-counter__count[\S\s]*?>\s*(\d+)   \s*<\/div>/g;
		let m;
		//let arr=[];
		let online=localStorage.check_online && localStorage.is_widget;
		while (m = r.exec(xhr.response)) {
			let q_id = m[1]-0;
			let title = clearString(m[2].trim());
			let date = m[3].trim();
			let views = m[4]-0;
			let answers = m[5]-0;
			//arr.push(1);
			/*arr.push({
				id:q_id,
				is_q:!!db.question[q_id],
				title:title,
				v:views,
				date:clearString(date),
				q:db.question[q_id],
			});*/
			let q = db.question[q_id];
			//if (q) log(q.ut, now > q.ut + 2.5 * 60000, Math.round((now - (q.ut + 2.5 * 60000))/1000));
			if (!q || online && answers>0 && (!q.cnt_a||q.cnt_a != answers||now > q.ut + 2.5 * 60000)) {
				q = analyzeQuestion(q_id);
				q.t = title;
				if (getFreshTime(date) <= 10) {
					setTimeout(()=>{
						checkQuestion(q_id);
					},4500);
				}
				//console.log('+'+(answers-q.cnt_a)+' ответа:',title);
			}
			q.cnt_a = answers;
			q.v = views;
			q.ut = now; //jj: мешает перепроверки для поиска онлайн пользователей?
			if (getFreshTime(date) > 10) continue;
			checkQuestion(q_id);
		}
		freeRegExp();
		clearNotifyFeedArr(now);
		//console.log('Новые вопросы:',arr.length);
	}
}

String.prototype.fastHashCode = function() {
	if (this.length === 0) return 0;
	let hash = 0;
	for (let i = 0; i < this.length; i++) {
		hash = ((hash<<5)-hash)+this.charCodeAt(i);
		hash = hash & hash; //32bit
	}
	return hash;
}

let events_list_navbar = ''; //events-list_navbar innerHTML
let events_list_navbar_hash = 0;


let bad_error_pause = 3;
let bad_error_tm_last = 0;


chrome.browserAction.setBadgeBackgroundColor({color:"#777"});
var arr_notifications = {};
let notifications_timer;
let notifications_pause = 0; //Метка активации паузы. 30 секунд нельзя спамить.
const tm_browser_load = (new Date()).getTime();
let getNotifications_last_time = 0; //Последнее обращение страницы.
let save_current_user = ''; //Текущий пользователь, или прошлый.
let tracker_q_ids = {}; //Вопросы в трекере, которые не нужно удалять.
let tracker_q_visited = false;
//let start_page = 10;
function updateNotificationOptions() {
	if (notifications_timer !== undefined) {
		clearInterval(notifications_timer);
		notifications_timer = undefined;
		tracker_q_ids = {};
		tracker_q_visited = false;
		//console.log('notifications disabled');
	}
	if (localStorage.enable_notifications == 1) {
		//console.log('notifications enabled');
		notifications_timer = setInterval(()=>{
			let now = (new Date()).getTime();
			if (now - bad_error_tm_last < bad_error_pause*1000) return log('skip');
			//if (now - getNotifications_last_time < 60000) return; //Страница не отвечает (никакая).
			let xhr = new XMLHttpRequest();
			let url = 'https://qna.habr.com/my/tracker';
			//let url = 'https://qna.habr.com/tracker/feed?page='+start_page;
			//console.log('----------Страница:',start_page);
			//start_page++;
			//if (start_page>75) start_page=75;
			
			xhr.open('GET', url, true);
			xhr.send(); rps++; //logg('send');
			xhr.onerror = ()=>{
				return; //Эта функция нужна, чтобы плавно форсировать бан по ip.
				//Но если держать RPS в пределах нормы, то этого не должно произойти.
				logg('onerror',xhr.status);
				bad_error_pause += 3600;
				logg('New pause =',bad_error_pause);
				bad_error_tm_last = now;
			}
			xhr.onload = function() { //logg('onload',xhr.status)
				tracker_q_visited = true;
				let now = (new Date()).getTime();
				if (xhr.status != 200) return;
				//Глобальное объявление
				let m = xhr.response.match(/<div class="alert[ "]{1}[^>]*>\s*(.*)/);
				if (m) {
					let message = m[1].trim();
					if (m = message.match(/^(.*)<a class="alert__btn_close/)) message = m[1].trim();
					if (message && localStorage.save_global_alert != message) {
						localStorage.save_global_alert = clearString(message);
						arr_notifications[1] = {
							w: 'Объявление',
							title: clearString(message),
							is_alert: true,
						};
					}
				}
				//Текущий пользователь
				let current_user;
				//if (localStorage.always_notify_my_questions == 1) {
				m = xhr.response.match(/<a class="user-panel__user-name" href="https:\/\/qna\.habr\.com\/user\/([^"]+)">/);
				if (m) {
					current_user=clearString(m[1]);
					save_current_user = current_user;
				}
				//Считаем кол-во уведомлений
				if (localStorage.enable_notifications == 1) {
					let cnt = 0;
					const START_HTML = '<ul class="events-list events-list_navbar">';
					let start = xhr.response.indexOf(START_HTML);
					let end = xhr.response.indexOf('</ul>',start);
					if (start > -1 && end > -1) {
						let aside_notifications = xhr.response.substring(start+START_HTML.length,end); //innerHTML
						let hash = aside_notifications.fastHashCode();
						if (hash !== events_list_navbar_hash) {
							events_list_navbar_hash = hash;
							events_list_navbar = clearString(aside_notifications);
							//console.log('Загружен новый хеш:',hash,aside_notifications);
						}
						//console.log("aside",aside_notifications);
						let m = aside_notifications.match(/<a class="link_light-blue" href="https:\/\/qna\.habr\.com\/my\/tracker">\s*.*\s*<span>(\d+)<\/span>/m);
						if (m) {
							cnt = m[1]-0;
						} else {
							m = aside_notifications.match(/<li class=[^>]*>\s*<a/gm);
							let li_cnt = m ? m.length : 0;
							cnt = li_cnt;
						}
					}
					//console.log("cnt:",cnt);
					chrome.browserAction.setBadgeText({text:""+cnt});
				}
				//Обрезаем и берем главный список
				let start = xhr.response.indexOf('<section class="page__body"');
				let end = xhr.response.indexOf('</section>',start);
				if (start === -1 || end === -1) return console.log('Ошибка парсинга трекера уведомлений');
				let html = xhr.response.substring(start,end);
				let notify_all = localStorage.notify_all==1;
				//Парсим на отдельные секции вопросов
				let r = /<a class="question__title-link" href="https:\/\/qna\.habr\.com\/q\/(\d+)">\s*(.*?)<\/a>[\s\S]*?<ul class="events-list">([\s\S]*?)<\/ul>/g;
				tracker_q_ids = {};
				while (m = r.exec(html)) { //Блок отдельного вопроса
					let Q_id = m[1]-0;
					tracker_q_ids[Q_id] = true;
					let Q_title = m[2].trim(); //console.log('Title:',Q_title);
					let ul = m[3];
					let q = db.question[Q_id];
					if (!q) {
						if (!Q_id) console.warn('Q_id=',Q_id,'html:',html);
						q = analyzeQuestion(Q_id, now);
						q.t = Q_title;
					} else q.ut = now; //jj: check online?
					let renamed, noticed;
					if (false) { //Из-за запредельной глючности в связи с кривой базой Тостера, лучше вообще отключить.
						if (!q.t || q.t != Q_title && q.t.replace('«','"').replace('»','"').replace('—','-').replace('>','&gt;') != Q_title) {
							//console.log("Переименование:",q.t,(q.t||'').length,Q_title,(Q_title||'').length);
							renamed = !!q.t;
							console.log('Rename:',q.t,Q_title);
							q.t = clearString(Q_title); //Быстрый синхронный title
							saveDB();
						}
					}
					let must_notify = notify_all || q.sub
						|| current_user && q.user_id == current_user && localStorage.always_notify_my_questions==1;
					let rr = /<input type="checkbox" class="event__checkbox" data-event_id="(\d+)"\s*([^>]*)>[\s\S]*?<div class="event__title">([\S\s]*?)<div class="event__date">(.*?)<\/div>/g;
					while (m = rr.exec(ul)) { //Блок отдельного уведомления
						let e = m[1]-0;
						let active = m[2] == 'checked';
						if (!active) continue;
						let message = m[3];
						let date = m[4].trim(); //только что, минуту назад, 2 минуты назад, 3 минуты назад
						if (getFreshTime(date) > 1) continue;
						//console.log(active,e,date);
						let a = { //action
							e:e, active:active, date:date, message:message, q:q, //renamed:renamed,
						}
						if (message.length > 500) {
							console.log('Слишком длинное уведомление',a);
							continue; //possible error
						}
						let nickname = (m = message.match(/<a\s\S*?\s*?href="https:\/\/qna\.habr\.com\/user\/(.*?)"/)) && m[1];
						a.nickname = nickname;
						if (message.indexOf('Модератор ') > -1) { //moderator
							if (!must_notify && !(localStorage.notify_moderator==1)) continue;
							if (message.indexOf('Модератор принял вашу правку вопроса') > -1) {
								a.what = 'Модератор принял правку';
							} else if (message.indexOf('Модератор удалил') > -1) {
								//Модератор удалил ответ от&nbsp;<a href="https://qna.habr.com/user/unsstrennen">unsstrennen</a>, на который вы жаловались с причиной: «Это какая-то реплика, а не ответ»
								a.what = 'Модератор удалил '+
									(message.indexOf('ответ') > -1? 'ответ' :
										(message.indexOf('вопрос') > -1? 'вопрос' :
											(message.indexOf('комментарий') > -1? 'комментарий' : 'что-то')
										)
									)
								;
								if (m = message.match(/причиной: «(.*)»/)) a.title = 'Причина: '+m[1].trim();
							} else {
								console.log('Неизвестное действие модератора',a);
								a.what = 'Модератор что-то сделал';
							}
						} else if (!nickname) {
							console.log('Не обнаружен автор уведомления!',a);
							continue;
						} else if (message.indexOf('принял вашу правку вопроса') > -1) {
							if (!must_notify && !(localStorage.notify_changes==1)) continue;
							a.what = 'Автор принял правку';
						} else if (message.indexOf('просит вас как эксперта ответить на вопрос') > -1) {
							if (!must_notify && !(localStorage.notify_expert==1)) continue;
							a.title = nickname + ' просит вас как эксперта ответить на вопрос';
							a.what = 'Эксперт нужен!';
						} else if (message.indexOf('подписался на') > -1) { //ваш вопрос
							if (!must_notify && !(localStorage.notify_about_likes==1)) continue;
							a.what = 'Подписка на вопрос ('+nickname+')';
							//a.title = nickname + ' подписался на ваш вопрос.';
						} else {
							let spaces,q_id,e2,anchor,what,url;
							m = message.match(/(\s*)<a href\s?=\s?"https:\/\/qna\.habr\.com\/\q\/(\d+)\?e=(\d+)[^#]*#?([^>]*)">([^<]+)<\/a>/);
							if (!m && (m = message.match(/(\s*)<a href\s?=\s?"https:\/\/qna\.habr\.com\/questionversion\?question_id=(\d+)&e=(\d+)[^#]*#?([^>]*)">([^<]+)<\/a>/))) {
								url = message.match(/<a href\s?=\s?"(https:\/\/qna\.habr\.com\/questionversion[^"]*)"/);
								if (url) a.url = url[1];
							}
							if (m) {
								//spaces = m[1];
								q_id=m[2]-0;
								if (q_id != Q_id) {
									console.log('ID вопроса не соответствует записи!',q_id,Q_id,a);
									continue;
								}
								e2=m[3]-0;
								if (e2 != e) {
									console.log('ID события не соответствует записи!',e2,a.e,a);
									continue;
								}
								anchor = m[4];
								what = m[5].trim();
								//a.spaces_len = spaces.length;
								a.anchor = anchor;
								a.what = what;
							} else {
								console.log('Нельзя получить ссылку на событие!',a);
								continue;
							}
							if (message.indexOf('написал') > -1) {
								//написал \n <a href="https://qna.habr.com/q/621216?e=7482397#comment_1877510">комментарий</a> \n к&nbsp;ответу на&nbsp;вопрос
								if (!must_notify && !(localStorage.notify_answer_comment==1)) continue;
								if (what == 'комментарий') what = 'Комментарий';
								else if (what=='ответ') what = 'Ответ';
								else what = 'Новый опус';
							} else if (message.indexOf('отметил решением') > -1) {
								if (!must_notify && !(localStorage.notify_about_solutions==1)) continue;
								if (what == 'ответ' || what == 'ваш ответ') what = 'Выбрано решение';
							} else if (message.indexOf('понравился') > -1) {
								if (!must_notify && !(localStorage.notify_about_likes==1)) continue;
								if (what == 'ваш ответ') what='Лайк';
							} else if (message.indexOf('упомянул вас в') > -1) {
								if (!must_notify && !(localStorage.notify_mention==1)) continue;
								if (what == 'комментарии' || what == 'ответе') what = 'Вас упомянули';
							} else if (message.indexOf('изменил&nbsp;свой') > -1) {
								if (!must_notify && !(localStorage.notify_changes==1)) continue;
								if (what == 'ответ' || what == 'вопрос') what = 'Изменение '+what+'а от '+nickname;
							} else if (what == 'правку') {
								if (!must_notify && !(localStorage.notify_changes==1)) continue;
								what = 'Предложение правки ('+nickname + ')';
							}
							a.what = what;
							a.anchor = anchor;
							if (!what || what.match(/^[а-яa-z0-9 ]/)) {
								console.log('Не удалось распознать уведомление',a);
								continue;
							}
						}
						//q.ut = now; //if (!q.is_pending) 
						if (!q.e || q.e < e) { //Новые данные
							q.e = e;
							q.ut = now;
							let notif = arr_notifications[Q_id];
							if(!notif) {
								notif = {
									q_id:Q_id,
									title:(a.title ? clearString(a.title) : q.t), //+ "\n" + a.date,
								};
								//console.log('Новое уведомление:',notif);
								arr_notifications[Q_id]=notif;
							}
							notif.e = e;
							if (a.what) notif.w = clearString(a.what);
							if (a.anchor) notif.anchor=clearString(a.anchor);
							if (a.url) notif.url = clearString(a.url);
							notif.tm = now; //not used
							noticed = true;
							//console.log('Уведомление:',a);
						}
					}
					if (renamed && !noticed) { //Вопрос переименован
						if (!must_notify && !(localStorage.notify_changes==1)) continue;
						let notif = arr_notifications[Q_id];
						if(!notif) {
							notif = {
								q_id:Q_id,
							};
							arr_notifications[Q_id]=notif;
						}
						notif.title = q.t;
						notif.w = 'Вопрос переименован';
						notif.url = 'https://qna.habr.com/q/'+Q_id;
						notif.tm = now; //not used
					}
				}
				freeRegExp();
			};
			if (tracker_q_visited) {
				let now = (new Date()).getTime();
				if (localStorage.notify_my_feed == 1) updateNitificationsMyFeed(now);
				if (localStorage.enable_notify_action == 1) updateNitificationsFilterAll(now);
			}
		}, 15000);
	} else {
		chrome.browserAction.setBadgeText({text:""});
	}
}
updateNotificationOptions();

//---------------------- CSS --------------------

const habr_css_fix_lines = `
/* ---------- МАГИЯ --------- /*

/* Магия в комментариях */
.content-list__item_comment	 {
	/* Делаем вертикальные линии. */
	border-left: 1px solid #707070;
}

.comment__message {
	/* Делаем отсутп слева, выравнивание по положению ника (на глаз). */
	padding-left: 33px;
	/* В Chrome и Opera 12 - почти идеально. */;
}

.comment__footer {
	/* Кнопку "ответить" тоже сдвигаем вправо, выравниваем. */
	padding-left: 33px;
}

.comment__folding-dotholder {
	/* Удаление точки при наведении на комментарий. Типа спасибо. Возможно, было и удобно кому-то. */
	background: none;
	display: none !important;
}

.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
{
	border-left: 1px solid #ff7030;
	/* Делаем 17ю линию другим цветом, т.к. это предел вложенности. */;
}

.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment .content-list__item_comment
.content-list__item_comment
{
	border-left: none;
	/* Далее убираем. */;
}

.megapost-cover__img, .megapost-cover__img_darken, .megapost-cover__inner {
	background:none !important;
	background-color:white !important;
}

.megapost-cover__inner, .megapost-cover_short, .megapost-cover__img	 {
	height:auto !important;
}

.preview-data__title-link, .megapost-cover_light .list__item, .megapost-cover_light .list__item-link,
.megapost-cover_light .preview-data__blog-link, .megapost-cover_light .preview-data__time-published {
	color: black !important;
}
`;

//----------- daytime ---------

function updateDateTimeDays(val) { //callback function from options
	let temp = parseFloat(val);
	if (temp !== temp) temp = 0;
	localStorage.datetime_days = temp;
}

//-------- version manage -------
let myVersion = chrome.runtime.getManifest().version, versionUpdated;
function updateVersion() { //Вызываем только если пользователь открыл сайт
	if (myVersion!==localStorage.version) {
		localStorage.version = myVersion;
		versionUpdated = (new Date()).getTime();
		localStorage.versionUpdated = versionUpdated;
	} else versionUpdated = localStorage.versionUpdated - 0;
}

//---------- rest ----------

function test_like()
{
	let xhr = new XMLHttpRequest();
	let url = 'https://qna.habr.com/answer/like?answer_id=56';
	xhr.open('POST', url, true);
	xhr.send(); rps++;
	xhr.onload = function() {
		console.log(xhr.status,xhr.responseText);
	}
}
function test_unlike()
{
	let xhr = new XMLHttpRequest();
	let url = 'https://qna.habr.com/answer/cancel_like?answer_id=1384993';
	xhr.open('POST', url, true);
	xhr.send(''); rps++;
	xhr.onload = function() {
		console.log(xhr.status,xhr.responseText);
	}
}
//https://qna.habr.com/q/567899
function test_post()
{
	let xhr = new XMLHttpRequest();
	let url = 'https://qna.habr.com/answer/likers_list?answer_id=56';
	xhr.open('POST', url, true);
	xhr.send(''); rps++;
	xhr.onload = function() {
		console.log(xhr.status,xhr.responseText);
	}
}
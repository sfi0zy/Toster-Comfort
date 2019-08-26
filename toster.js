let savetime1 = performance.now(),log=console.log;
let checkPoint = s=>{return;let t=performance.now(); log(s,t-savetime1); savetime1=t};
let d=document,URL,Q,did=e=>d.getElementById(e),manifest=chrome.runtime.getManifest(),owner,mainmenu={},g_status,
	ext_url=chrome.runtime.getURL('');
let sel = cl=>d.querySelector(cl);
let c = (tag,val,cl) => {
	let e = d.createElement(tag);
	if(val)e.innerText = val;
	if(cl){
		if (typeof cl=='string')e.className=cl;
		else for (let k in cl) e.setAttribute(k,cl[k]);
	}
	return e;
};
Element.prototype.a=function(tag,val,cl){
	if (typeof tag != 'string') {
		for(let i=0;i<arguments.length;i++) this.appendChild(arguments[i]);
		return this;
	}
	let n = c(tag,val,cl);
	this.appendChild(n);
	return n;
}
function clearString(s) {
	return s.length < 12 ? s : (' ' + s).slice(1);
}

//FireFox check is page is loaded
const fixFirefox = !did('toster-comfort-sign');

//remove elements from array of objects by id
function removeA(arr,id) {
	for(let i=arr.length-1;i>=0;i--){
		if (arr[i].id == id) {
			arr.splice(i, 1);
		}
	}
    return arr;
}

let user_html_result;
function user_html(user,no_name) {
	user_html_result = true;
	if (!user) return (user_html_result = false);
	let html = ' | ';
	if (!no_name) {
		if (OPTIONS.show_name == 1 && OPTIONS.show_nickname == 1) {
			if (user.name == user.nickname || !user.name) html += '@'+user.nickname;
			else html += user.name+' @'+user.nickname;
		} else if (OPTIONS.show_nickname == 1) {
			html += '@'+user.nickname;
		} else if (OPTIONS.show_name == 1 && user.name) { // strange option, but ok
			html += user.name;
		}
	}
	//stats & questions
	if (user.solutions !== undefined) {
		let cnt_q_color = user.cnt_q < 4 ? 'red' : '#2d72d9';
		let honor = user.con || 0;
		html += //https://toster.ru/user/dollar/tags
			(OPTIONS.show_honor && !OPTIONS.sol_honor_replace?' &nbsp;<a style="color:#a98ae7;font-size:13px;" title="Вклад: '
				+honor+'" href="https://toster.ru/user/'+user.nickname+'/tags"><b>'+honor+'</b></a>':'')
			+(!OPTIONS.show_cnt_questions?'':' &nbsp;<a href="https://toster.ru/user/'+user.nickname
				+'/questions" title="Вопросов: '+user.cnt_q+'" class="norma"><font color='+cnt_q_color+'>'+user.cnt_q
				+'</font></a>')
			+(!OPTIONS.show_cnt_answers?'':' &nbsp;<a href="https://toster.ru/user/'+user.nickname+'/answers" title="Ответов: '+user.cnt_a
				+'" class="norma">'+user.cnt_a+'</a>')
			+(OPTIONS.show_perc_solutions && !OPTIONS.sol_honor_replace?' &nbsp;<font color=#65c178 style="font-size:13px;" title="Решений: '
				+user.cnt_s+'%">'+user.cnt_s+'%</font>':'')
			+(OPTIONS.show_honor && OPTIONS.sol_honor_replace?' &nbsp;<a style="color:#a98ae7;font-size:13px;" title="Вклад: '
				+honor+'" href="https://toster.ru/user/'+user.nickname+'/tags"><b>'+honor+'</b></font>':'')
			+(!OPTIONS.show_perc_sol_marks?'':' &nbsp;<a href="https://toster.ru/user/'+user.nickname+'/questions" title="Отметил решениями: '
				+user.solutions+'%" style="font-size:13px"><b><font color=#000>'+user.solutions+'%</font></b></a>');
	} else user_html_result = false;
	//karma
	if (user.karma !== undefined) {
		let karma_word = OPTIONS.hide_word_karma == 1 ? '' : '<font color=#999>Карма:</font> ';
		if (!isNaN(parseFloat(user.karma)))
			html += ' &nbsp;'+karma_word+'<a href="https://habr.com/users/'
				+user.nickname+'/comments/" target=_blank style="font-size:13px" title="Карма пользователя на Хабре"><b>'
				+ (user.karma < 0 ? '<font color=red>' : '<font color=#6c8d00>+')
				+ user.karma + '</font></b></a>';
		else {
			let k = user.karma === 'r' ? 'read-only' : (user.karma === 'n' ? 'не зарегистр.' : user.karma);
			if (k === 'read-only')
				html += ' &nbsp;'+karma_word+'<a href="https://habr.com/users/'
					+user.nickname+'/" target=_blank style="font-size:13px;color:#898D92;font-weight:normal" title="Статус пользователя на Хабре">'
					+ k + '</font></a>';
			else
				html += ' &nbsp;'+karma_word
					+ '<span style="font-size:13px;color:#898D92" title="Статус пользователя на Хабре">'
					+ k + '</span>';
		}
		if (user.stat_pub || user.stat_comment) {
			html += '<span title="Публикаций/комментариев на Хабре" class="show_habr" style="font-size:13px;color:#898D92;'
				+ (OPTIONS.show_habr == 1?'':'display:none')+'"> '
				+ (user.stat_pub || '0') + '/' + (user.stat_comment || '0');
		}
	} else user_html_result = false;
	html = '<span style="font-weight: normal">'+html+'</span>';
	if (user.solutions_pending || user.karma_pending) user_html_result = false;
	return html;
}

let qdb = {} // q_id => user
let elem = []; // {e:elem, id:q_id}
let request_questions = []; // [{id:123}, {id:234,v:5}, ... ]
let elem_top_24 = []; // {e:elem, }

function makeTags(tags) {
	let ul = c("UL");
	ul.className = 'tags-list';
	for(let id in tags) {
		let li = c("LI");
		li.className = 'tags-list__item';
		let a = c("A",tags[id]);
		a.href = 'https://toster.ru/tag/' + id;
		ul.a(li.a(a));
	}
	return ul;
}

//Скрыть элемент, либо просто затемнить (на белом фоне)
function hideElementClever(el) {
	if (!OPTIONS.make_dark) {
		el.style.display = 'none';
		return;
	}
	let div = c('div');
	div.style.position = 'absolute';
	div.style.width = (el.clientWidth || 10) + 'px';
	div.style.height = (el.clientHeight || 10) + 'px';
	div.style.background = 'rgba(255,255,255,.7)';
	div.style.top = '0';
	div.style.pointerEvents = 'none';
	el.a(div);
}

function update_questions(on_success, on_fail) {
	try {
		chrome.runtime.sendMessage({
			type: "getQuestions",
			arr: request_questions,
		}, function(data) {
			//log("getQuestions",data);
			let cnt = 0;
			for(let q_id in data) {
				qdb[q_id] = data[q_id]; //copy (update missing elements)
				cnt++;
			}
			//log('Update Question List:',cnt);
			let success = true;
			elem.forEach(q=>{
				if (q.tc_done) return;
				if (OPTIONS.hide_solutions && q.solution === undefined) {
					const found = q.e.parentNode.parentNode.parentNode.parentNode.querySelector('svg.icon_check');
					q.solution = !!found;
					if (found) {
						q.tc_done = true;
						let parent = q.e.parentNode.parentNode.parentNode.parentNode.parentNode;
						hideElementClever(parent)
						//return;
					}
				}
				const rec = qdb[q.id];
				if (!rec) {
					if (!q.tc_done) success = false;
					return;
				}
				if (rec.hide && !q.tc_done) {
					q.tc_done = true;
					let parent = q.e.parentNode.parentNode.parentNode.parentNode.parentNode;
					hideElementClever(parent);
					//return;
				}
				let user = rec.u;
				let html = user_html(user);
				if (html) {
					q.e.innerHTML = html;
				}
				if (user_html_result) {
					if (OPTIONS.show_blue_circle && (rec.q.sub || rec.q.sb)) { //html+='<span class="dot"></span>';
						let q_wrap = q.e.parentNode.parentNode;
						if (q_wrap) {
							let q_title = q_wrap.querySelector('.question__title');
							if (q_title) {
								let dot = q_title.querySelector('.dot_sub') || q_title.querySelector('.dot_sb');
								if (!dot) {
									if (rec.q.sub) q_title.a('span',null,'dot_sub');
									else q_title.a('span',null,'dot_sb');
								}
							}
						}
					}
					removeA(request_questions, q.id);
					q.tc_done = true;
				}
				else if (!q.tc_done) success = false;
				//Change color
				if (rec.color) {
					let parent = q.e.parentNode.parentNode.parentNode.parentNode.parentNode;
					parent.style.backgroundColor = rec.color;
				}
			});
			elem_top_24.forEach(t=>{
				if (t.tc_done == 2) return;
				const rec = qdb[t.id];
				if (!rec) return (success = false);
				if (rec.hide) {
					t.tc_done = 2;
					t.e.style.display = 'none';
					return;
				}
				if (!t.tc_done) {
					if (OPTIONS.top24_show_tags) {
						const tags = rec.q.tags;
						if (tags) {
							t.e.insertBefore(makeTags(tags), t.a);
							t.e.insertBefore( c("BR"), t.a);
						}
					}
					t.tc_done = 1;
				}
				if (t.tc_done == 1) {
					if (!OPTIONS.top24_show_author) {
						t.tc_done = 2;
						return;
					}
					const user = rec.u;
					if (user) {
						let html = user_html(user,true);
						if (html) {
							if (!t.author) {
								let newItem = t.author = c("NOBR");
								newItem.innerHTML = html;
								t.e.insertBefore( newItem, t.a);
								t.e.insertBefore( c("BR"), t.a);
							} else {
								t.author.innerHTML = html;
							}
						}
						if (user_html_result) {
							removeA(request_questions, t.id);
							t.tc_done = 2;
							return;
						}
					}
				}
				success = false;
			});
			if (on_success && success) on_success();
			else if (on_fail && !success) on_fail();
		});
	} catch(e) {
		log('Ошибка доступа к расширению TC.');
	}
}

//all questions
let found_first_q_id=0;
let top24_done;
function parse_questions() {
	request_questions = [];
	elem=[];
	let q,first;
	if (1) {
		//content-list__item - li
		//question question_short - такое
		//question__content
		//question__content_fluid
		//question__tags
		q = d.getElementsByClassName('question__tags');
		for(let i=0;i<q.length;i++) {
			let complexity = q[i].querySelector('.question__complexity');
			if (!complexity) q[i].a(complexity = c('span',null,'question__complexity'));
			complexity.innerText = '...';
			let container = complexity.parentNode.parentNode;
			let a = container.querySelector('h2 > a');
			let views_boxes = container.querySelectorAll('.question__views-count');
			let views_box = views_boxes[views_boxes.length-1];
			let m = views_box && views_box.innerHTML.match(/(\d+)\s*просмот/);
			let views = m && m[1] || '0';
			let result = /\d+/.exec(a.href);
			if (result) {
				let q_id = result[0];
				if(!first){
					found_first_q_id=q_id-0;
					first=true;
				}
				elem.push({e:complexity, id:q_id, v:views});
				request_questions.push({id:q_id,v:views});
			}
		}
	}
	if(!top24_done){
		top24_done=true;
		elem_top_24=[];
		if ((OPTIONS.top24_show_tags || OPTIONS.top24_show_author) && !OPTIONS.aside_right_hide && OPTIONS.top24_show) {
			q = d.querySelectorAll('dl[role="most_interest"] > dd > ul.content-list > li.content-list__item');
			for(let i=0;i<q.length;i++) {
				let a = q[i].querySelector('a');
				if(!a)continue;
				let result = /\d+/.exec(a.href);
				if (result) {
					elem_top_24.push({e:q[i], a:a, id:result[0]});
					request_questions.push({id:result[0]});
				}
			}
		}
	}
	update_questions(null,()=> {
		let timer_index = setInterval(()=>{
			update_questions(()=>{ clearInterval(timer_index); });
		},500);
		setTimeout(()=>{
			clearInterval(timer_index);
		},17000);
	});
}

let udb = {}; // nickname => user
let elem_user = []; // {e:elem, nickname:nickname} // .e property is an element with class 'user-summary__nickname'
let request_user = {}; // nickname => true

function update_q(on_success, on_fail) {
	chrome.runtime.sendMessage({
		type: "getUsers",
		arr: request_user,
	}, function(data) {
		//log("getUsers",data);
		//let cnt = 0;
		for(let nickname in data) {
			udb[nickname] = data[nickname]; //copy (update missing elements)
			//cnt++;
		}
		//log('Update Question Records:',cnt);
		let result = true;
		let users_with_info = {}; //local cache
		let answer_author = '';
		elem_user.forEach(x=>{
			if (x.done) return;
			let user = udb[x.nickname];
			if (!user) {
				result = false;
				return;
			}
			if (user.ban) { //Это сразу конец работы с данным пользователем. Вычеркиваем
				let e = x.e;
				while (e=e.parentNode) {
					if (e.tagName == 'LI') {
						let comment = e.querySelector('.comment');
						if (comment) {
							comment.style.display = 'none';
							e.a('i',!OPTIONS.show_ban_info?'Комментарий скрыт.':'Комментарий пользователя @'+x.nickname+' скрыт.');
						} // else e.style.display = 'none';
					} else if (!e.classList) {
						log('ERROR! tag = ',e.tagName,e);
						break;
					} else if (e.classList.contains('content-list__item')) {
						let wrapper = e.querySelector('.answer_wrapper');
						if (wrapper) {
							if (e.parentNode.parentNode.id == 'solutions') {
								if (OPTIONS.dont_ban_solutions) break; //отменяем бан
								e.a('i',!OPTIONS.show_ban_info?'Решение скрыто.':'Решение пользователя @'+x.nickname+' скрыто.');
							} else {
								e.a('i',!OPTIONS.show_ban_info?'Ответ скрыт.':'Ответ пользователя @'+x.nickname+' скрыт.');
							}
							wrapper.style.display = 'none';
						} // else e.style.display = 'none';
					} else if (e.classList.contains('question-head')) { //вопрос
						break; //не баним
					} else continue;
					//e.style.display = 'none';
					x.done = true;
					delete request_user[x.nickname];
					return;
				}
			}
			let html = user_html(user,true);
			if (user_html_result) {
				if (html && !x.done) {
					x.e.innerHTML += html;
					x.done = true;
				}
				delete request_user[x.nickname];
			}
			else result = false;
			let is_hint = false;
			if (!(OPTIONS.psycho_not_myself && x.nickname == owner)) {
				is_hint = !!user.hint;
				if (!is_hint && user.con > 0 && OPTIONS.psycho_summary) {
					is_hint = true
					user.blue = true //цвет обычной оценки
					if (user.con < 20) {
						user.hint = 'Новичек';
						user.note = '#Пытается освоиться с кнопками на Тостере.';
					} else if (user.con < 100) {
						user.hint = 'Любитель';
						user.note = '#Творит добро, помогает хорошим людям.';
					} else {
						user.hint = 'Профи';
						user.note = '#Знает правила Тостера.';
					}
				}
			}
			let is_ach = !!user.ach;
			if (user.cnt_s && (is_hint || is_ach)) { //Показываем статусы только после первой подгрузки информации о пользователе.
				let parent = x.e.parentNode; // element with class 'user-summary__desc'
				let myhint = parent.querySelector('span.user-summary-comfort');
				if (!myhint) {
					//fix comments
					let parent_container = parent.parentNode.parentNode.parentNode; //div
					if (parent_container.classList.contains('comment')) { //this is comment!
						if (is_hint && (OPTIONS.psycho_hide_comments
							|| x.nickname == answer_author && OPTIONS.psycho_hide_same_author
							|| OPTIONS.psycho_hide_next && users_with_info[x.nickname]))
							is_hint = false;
						if (is_ach && (OPTIONS.achiever_hide_comments
							|| x.nickname == answer_author && OPTIONS.achiever_hide_same_author
							|| OPTIONS.achiever_hide_next && users_with_info[x.nickname])) is_ach = false;
						users_with_info[x.nickname] = true;
						let cnt = (is_hint + is_ach);
						if (cnt == 0) return; // ------> don't add info and all other actions
						let body = parent_container.querySelector('.comment__body');
						if (body) {
							// -20px by default
							let marginTop = -20 + (cnt == 2 ? 25 : 15);
							body.style.marginTop = marginTop + 'px';
						}
					} else if (parent_container.classList.contains('answer')) { //this is anwer!
						answer_author = x.nickname;
						users_with_info = {};
					}
					//add info
					let about = parent.querySelector('div.user-summary__about');
					if (about) {
						parent = about;
						if (is_hint && OPTIONS.psycho_replace || is_ach && OPTIONS.achiever_replace) parent.innerText = '';
						else parent.a('br');
					}
					else parent.a('br');
					myhint = parent.a('span',null,'user-summary-comfort');
					if (is_hint) {
						let data = {style:'font-weight:bold; color:#a9bb1e;','data-psycho':user.note,'data-user':x.nickname};
						if (user.blue) data.style = 'font-weight:bold; color:#aaaaff;';
						myhint.a('span',user.hint,data);
					}
					if (is_hint && is_ach) myhint.a('br');
					if (is_ach) {
						myhint.a('span','Ачивер',{style:'font-weight:bold; color:#ed7503;','data-psycho':
							user.ach == 3 ? ' Этот пользователь является НАСТОЯЩИМ ачивером и ревниво относится к оценкам своего творчества. Если вы не уделите внимания и не отблагодарите его (кнопкой), то он может психануть и удалить свой ответ!':
							user.ach == 2 ? ' У этого пользователя КРАЙНЕ высокий процент решений. Он наверняка удалит свой ответ без отметки о решении.':
							user.ach == 1 ? ' Судя по ПОДОЗРИТЕЛЬНО высокому проценту решений, этот пользователь может удалить свой ответ, если он никому не понравится и автор вопроса не отблагодарит (кнопкой).':
							' Ошибка: '+user.ach
						});
					}
				}
			}
		});
		//log('result',result);
		//log('elem_user',elem_user);
		if (on_success && result) on_success();
		else if (on_fail && !result) on_fail();
	});
}

//page of the question
function parse_q() {
	let q = d.getElementsByClassName('user-summary__nickname');
	for(let i=0;i<q.length;i++) {
		let a = q[i].innerHTML.match(/<meta itemprop="alternateName" content="(.+)">/);
		if (a) {
			let nickname = a[1];
			elem_user.push({
				e:q[i],
				nickname:nickname,
			});
			request_user[nickname] = i==0 ? 1 : true;
			//Предполагаем, что первый в списке - автор вопроса.
			if (i == 0) {
				let qm = location.href.match(/toster\.ru\/q\/(\d+)/);
				let tags = sel('.tags-list');
				let q_title = sel('.question__title');
				let grp = sel('.buttons-group_question');
				//log('grp',grp.className,grp);
				let btn = grp && grp.querySelector('.btn_subscribe');
				//log('btn',btn.className,btn);
				chrome.runtime.sendMessage({
					type: 'directQuestionUpdate',
					nickname:nickname,
					q_id:qm && qm[1]-0,
					tags_html: tags && tags.outerHTML,
					title: q_title && q_title.innerHTML.trim(),
					sb: btn && btn.className == 'btn btn_subscribe btn_active',
				});
				if (grp) grp.addEventListener('click',e=>{
					if (e.target.className.indexOf('btn_subscribe') === -1) return;
					btn = grp.querySelector('.btn_subscribe');
					if (!btn) return;
					chrome.runtime.sendMessage({
						type: 'directQuestionUpdate',
						nickname:nickname,
						q_id:qm && qm[1]-0,
						sb: btn && btn.className == 'btn btn_subscribe', //всё наоборот
					});
				});
			}
		}
	}
	//log(elem_user);
	update_q(null,()=> {
		let timer_index = setInterval(()=>{
			//log('timer');
			update_q(()=>{ clearInterval(timer_index); });
		},500);
		setTimeout(()=>{
			clearInterval(timer_index);
		},17000);
	});
}

//Enable/disable Ctrl+Enter handler
function set_placeholder(text) {
	const textareas = d.querySelectorAll('textarea.textarea');
	for(let i=0; i<textareas.length; i++) {
		textareas[i].setAttribute('placeholder', text);
	}
}

function ctrl_enter_handler(event) {
	const target = event.target;
	if (target.classList.contains('textarea')) {
		const form = event.target.form;
		const button = form.querySelector('button[type="submit"]');
		if (button) {
			if ((event.ctrlKey || event.metaKey) && (event.keyCode === 13 || event.keyCode === 10)) {
				button.click();
			};
		}
	}
}

function set_ctrl_enter_handler() {
	d.addEventListener('keydown', ctrl_enter_handler);
	set_placeholder('Жми Ctrl+Enter для отправки формы');
}

//Enable save form toLocalStorage
let all_textarea = {};
function enable_save_form_to_storage() {
	const now = (new Date()).getTime();
	for(let key in localStorage) {
		if(key[0]!='q')continue;
		try {
			let data=JSON.parse(localStorage[key]);
			if (data.ut < now - 86400000) delete localStorage[key];
		}catch(e){log('localStorage erorr:',e)}
	}
	let q = Q;
	if(!q) {
		let m = location.href.match(/^https?:\/\/toster\.ru\/questionversion\/new\?question_id=(\d+)/);
		if (m) q = m[1]-0;
		else {
			m = location.href.match(/^https?:\/\/toster\.ru\/question\/new/);
			if (m) q = 'new';	else return;
		}
	}
	for(let i=d.forms.length-1;i>=0;i--) {
		let f = d.forms[i], ta, tn, inputs, inp;
		if (f.classList.contains('form_comments')) tn = 'qc_'+q;
		else if (f.id == 'answer_form') tn = 'q_'+q;
		else if	(f.id.indexOf('answer_comment_form_') === 0) tn = 'qac_'+f.id.substr(20);
		else if (f.classList.contains('form_add_question')) {
			tn = 'qn_';
			inputs = {};
			if (inp = f.querySelector('input#question_title')) inputs['qntit_'] = inp;
			//if (inp = f.querySelector('input#question_tags')) inputs['qntag_'] = inp;
		} else if (f.classList.contains('form_edit_question')) { log('edit');
			tn = 'qe_'+q;
			inputs = {};
			if (inp = f.querySelector('input#question_title')) inputs['qetit_'+q] = inp;
			//if (inp = f.querySelector('input#question_tags')) inputs['qetag_'+q] = inp;
		}
		if (!tn) continue;
		if (!(ta=f.querySelector('textarea'))) continue;
		all_textarea[tn] = ta;
		restore_form_from_storage(tn);
		f.addEventListener('submit', remove_form_from_storage(tn));
		ta.addEventListener('input', save_form_to_storage(tn));
		if(inputs)for(let id in inputs) {
			all_textarea[id] = inputs[id];
			restore_form_from_storage(id);
			f.addEventListener('submit', remove_form_from_storage(id));
			inputs[id].addEventListener('input', save_form_to_storage(id));
		}
	}
}

function save_form_to_storage(id) {
	return e => {
		if (!e.target.value) {
			delete localStorage[id];
			return;
		}
		localStorage[id] = JSON.stringify({t: e.target.value, ut: (new Date()).getTime()});
	}
}

function restore_form_from_storage(id) {
	if(!localStorage[id])return;
	let data=JSON.parse(localStorage[id]);
	data.ut = (new Date()).getTime();
	localStorage[id] = JSON.stringify(data);
	all_textarea[id].value = data.t;
}

function remove_form_from_storage(id) {
	return e => delete localStorage[id];
}

let is_options_loaded = false;
let arr_on_options_callback = [];
function listenOnOptions(fn) {
	if (is_options_loaded) fn();
	else arr_on_options_callback.push(fn);
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

let aside_timer;
function updateAside(data) { //Получили новые уведомления
	if (aside_timer) {
		clearTimeout(aside_timer);
		aside_timer = undefined;
	}
	if (aside_mouseover) { //нельзя менять контент прямо под мышью.
		aside_timer = setTimeout(e=>updateAside(data),500);
		return;
	}
	let ul = sel(".events-list_navbar");
	aside_hash = data.hash;
	if (!ul) return log('Некуда вставлять уведомления');
	ul.innerHTML = data.html;
	//log('Апдейтим уведомления:',aside_hash,data.html.length,ul.innerHTML.length,data.html);
}

let window_focus = true;
window.addEventListener("blur",e=>window_focus=false);
window.addEventListener("focus",e=>window_focus=true);

let R_Q_SEARCH = /<a class="question__title-link question__title-link_list" href="https?:\/\/toster\.ru\/q\/(\d+)">/;
let cache_page_1, cache_page_1_tm=0, cache_page_1_q=0, cache_page_1_q_hash=0,
	cache_my_feed, cache_my_feed_tm, cache_my_feed_q=0, cache_my_feed_hash=0;
function getInfo(info) {
	if (info.cache_page_1_tm) { //Кешированная страница 
		cache_page_1_tm = info.cache_page_1_tm;
		cache_page_1 = info.cache_page_1;
		let m = cache_page_1.match(R_Q_SEARCH);
		if (m) cache_page_1_q=m[1]-0;
	}
	if (info.cache_my_feed_tm) { //Кешированная страница 
		cache_my_feed_tm = info.cache_my_feed_tm;
		cache_my_feed = info.cache_my_feed;
		let m = cache_my_feed.match(R_Q_SEARCH);
		if (m) cache_my_feed_q=m[1]-0;
	}
	//automatic update
	if (g_status == 'all' && cache_page_1_q > 0 && cache_page_1.fastHashCode() != cache_page_1_q_hash) {
		cache_page_1_q_hash = cache_page_1.fastHashCode();
		DOM.page.innerHTML = cache_page_1;
		found_first_q_id=cache_page_1_q;
		localStorage.qcnt_all = cache_page_1_q;
		parse_questions();
	} else if (g_status == 'feed' && cache_my_feed_q > 0 && cache_my_feed.fastHashCode() != cache_my_feed_hash) {
		cache_my_feed_hash = cache_my_feed.fastHashCode();
		DOM.page.innerHTML = cache_my_feed;
		found_first_q_id=cache_my_feed_q;
		localStorage.qcnt_feed = cache_my_feed_q;
		parse_questions();
	}
	//link update
	if(cache_page_1_q > 0 && mainmenu.all){
		if (cache_page_1_q-localStorage.qcnt_all>0) mainmenu.all.a.childNodes.forEach(n=>{
			if (n.nodeType == 3 && n.data.trim().indexOf('Все вопросы')==0) n.data = 'Все вопросы ('+(cache_page_1_q-localStorage.qcnt_all)+')';
		}); else mainmenu.all.a.childNodes.forEach(n=>{
			if (n.nodeType == 3 && n.data.indexOf('Все вопросы ')==0) n.data = 'Все вопросы';
		});
	}
	if(cache_my_feed_q > 0 && mainmenu.myfeed){
		if (cache_my_feed_q-localStorage.qcnt_feed>0) mainmenu.myfeed.a.childNodes.forEach(n=>{
			if (n.nodeType == 3 && n.data.trim().indexOf('Моя лента')==0) n.data = 'Моя лента ('+(cache_my_feed_q-localStorage.qcnt_feed)+')';
		}); else mainmenu.myfeed.a.childNodes.forEach(n=>{
			if (n.nodeType == 3 && n.data.indexOf('Моя лента ')==0) n.data = 'Моя лента';
		});
	};
	//online users
	if(info.users && OPTIONS.check_online){
		while (div_online.firstChild) div_online.removeChild(div_online.firstChild);
		info.users.forEach(u=>{
			let a = div_online.a('a',0,{href:'https://toster.ru/user/'+u.nick+'/info'}).a('img',0,
				{src:u.img?'https://habrastorage.org/'+u.img:ext_url+'images/nouser.png', width:"35", height:"35"});
		});
		if(info.need_check)checkOnlineUsers();
		if(info.need_vote)voteOnline(info.need_vote);
	}
}

function updateInfoColor() {
	let now = (new Date()).getTime();
	if (mainmenu.all) mainmenu.all.a.style.color = (now - cache_page_1_tm < 21500) ? '#9d9' : '#a7b3cb';
	if (mainmenu.myfeed) mainmenu.myfeed.a.style.color = (now - cache_my_feed_tm < 21500) ? '#9d9' : '#a7b3cb';
}


function updateNotifications(is_first_time) {
	try {
		let is_active = (d.hidden===true
			||d.webkitHidden===true
			||d.visibilityState=='hidden'
			||d.visibilityState=='prerender'
			||window_focus===false
		) ? 1 : 0;
		chrome.runtime.sendMessage({
			type: "getNotifications",
			active: is_active,
		}, function(arr) {
			for (q_id in arr) {
				let item = arr[q_id];
				if (q_id == 1) { //Не уведомление, а просто инфа о боковой панели
					if (is_first_time) continue;
					if (aside_hash != item.hash) {
						//log('Несовпадение хеша:',item.hash,aside_hash);
						aside_hash = item.hash;
						chrome.runtime.sendMessage({type:'getAside'},updateAside);
					}
					continue;
				}
				if (q_id == 2) { 
					getInfo(item);
					continue;
				}
				let n = new Notification(item.w, {body: item.title, tag:item.title,
					icon:'https://habrastorage.org/r/w120/files/c99/6d8/5e7/c996d85e75e64ff4b6624d2e3f694654.jpg'});
				n.onclick = function(){
					window.focus();
					n.close();
					if (item.q_id) {
						let url = item.url;
						if (!url) {
							if (item.anchor) url = "https://toster.ru/q/"+item.q_id+"?e="+item.e+"#"+item.anchor;
							else url = "https://toster.ru/q/"+item.q_id;
						}
						window.location.href = url;
					}
					if (item.is_alert) {
						let al = sel('.alert');
						if (!al) {
							let notices = sel('.notices-container');
							if (notices) {
								let page = sel('.page');
								if (!page) return;
								notices = c("DIV",null,'flash-notices');
								page.insertBefore(notices, page.childNodes[0]);
							}
							notices.a(al = c("DIV",null,'alert alert_info'));
						}
						al.innerText = item.title;
					}
				}
			}
			updateInfoColor();
		});
	} catch(e) {
		//log('Extension unloaded!');
		let tag = document.activeElement.tagName.toLowerCase();
		if (tag == 'textarea' || tag == 'input') return;
		window.location.reload();
	}
}

//Добавить кнопку "Следить", чтобы получать быстрые уведомления
function addListenButton() {
	if (location.href.indexOf('https://toster.ru/q/') == -1) return;
	let m = location.href.match(/^https:\/\/toster\.ru\/q\/(\d+)/);
	if (!m) return;
	let qnum = m[1]-0;
	let tags = sel('.question__tags');
	if (!tags) return;
	chrome.runtime.sendMessage({
		type: "getSubStatus",
		qnum: qnum,
	}, function(status) {
		const DISABLED = 'btn btn_subscribe';
		const ENABLED = 'btn btn_subscribe btn_active';
		let div = c('DIV');
		div.style.position = 'absolute';
		div.style.right = "30px";
		let a = c('A', status ? 'Отслеживается' : 'Следить', status ? ENABLED : DISABLED);
		a.title = "Получать быстрые уведомления";
		div.a(a);
		//div.innerHTML = '<a class="btn btn_subscribe btn_active" href="asd" title="Получать быстрые уведомления">Следить</a>';
		tags.a(div);
		//tags.innerHTML += '<div style="background-color:red;top: 0;left:100px;width:200px">подписаться</div>';
		a.addEventListener('click',()=>{
			if (!status) {
				let subscribe_button = did('question_interest_link_'+qnum);
				if (subscribe_button && subscribe_button.className == DISABLED) {
					subscribe_button.click();
				}
			}
			chrome.runtime.sendMessage({type: "setSubStatus", qnum:qnum}, function(new_status) {
				status = new_status;
				a.className = new_status ? ENABLED : DISABLED;
				a.innerText = new_status ? 'Отслеживается' : 'Следить';
			});
		});
	});
	
}

let aside_hash = 0;
let aside_mouseover;
function initNotifications() {
	if (!window.Notification || !Notification.permission) return; //not supported
	if (Notification.permission == "denied") return;
	if (Notification.permission != "granted") {
		Notification.requestPermission(function (status) {
			if (status !== "granted") {
				chrome.runtime.sendMessage({type: "disableNotifications"});
				return;
			}
			setInterval(updateNotifications, 3000);
		});
		return;
	}
	setInterval(updateNotifications, 3000);
	updateNotifications(true);
	//add subscribe button
	if (!OPTIONS.notify_all) addListenButton();
	//Пересчет уведомлений для иконки
	let ul = sel(".events-list_navbar");
	if (ul) {
		ul.addEventListener('mouseover',e=>aside_mouseover=1);
		ul.addEventListener('mouseout',e=>aside_mouseover=0);
		let counter = ul.querySelector(".events-list__item_more");
		let m, cnt;
		if (counter && (m = counter.innerHTML.match(/<span>(\d+)<\/span>/))) {
			cnt = m[1] - 0;
		} else {
			let lis = ul.querySelectorAll(".events-list__item a");
			cnt = lis.length;
			if (cnt && lis[cnt-1].href == "https://toster.ru/my/tracker") cnt--;
		}
		aside_html = ul.innerHTML.replace(' style="overflow-wrap: break-word;"','');
		aside_hash = aside_html.fastHashCode();
		//log('Хеш при загрузке:',aside_hash,aside_html.length,aside_html);
		chrome.runtime.sendMessage({type: "updateIconNum", cnt:cnt, hash:aside_hash, html:aside_html});
	}
}

//Блокировка рекламы, Виджет
let widget_version,div_online;
function AsideRightFilters() {
	removeCustomCSS(css_right_hide);
	if (!(OPTIONS.aside_right_hide==1 || OPTIONS.aside_right_noads==1 || OPTIONS.is_widget==1 || OPTIONS.top24_show!=1)) return;
	let aside = d.getElementsByClassName('column_sidebar')[0];
	if (!aside) return log('Правая колонка не найдена');
	if (OPTIONS.aside_right_noads==1) {
		let promo = sel('.promo-block');
		if (promo) promo.style.display = 'none';
		//for sure
		let imgs = aside.getElementsByTagName('img');
		for(let i=0;i<imgs.length;i++) {
			let img = imgs[i];
			img.style.display = 'none';
			img.parentNode.style.display = 'none';
		}
		//empty block
		let empty = sel('.empty-block');
		if(empty)empty.style.display='none';
	}
	for (let i=0;i<aside.children.length;i++) {
		let dl = aside.children[i];
		if (OPTIONS.aside_right_hide == 1
			|| OPTIONS.aside_right_noads==1 && (dl.getAttribute('role') != 'most_interest' || !OPTIONS.top24_show) && dl.className != 'panel-heading'
		)
			dl.style.display = 'none';
	}
	if (OPTIONS.is_widget) {
		let widget = c('dl',0,'panel-heading panel-heading_inner')
		let add=e=>widget.a('dd',0,'panel-heading__content panel-heading__content_inner');
		widget.a('dt','Toster Comfort ','panel-heading__title panel-heading__title_underline')
			.a('span',manifest.version_name || manifest.version, OPTIONS.is_new && 'tc_new');
		
		if(OPTIONS.is_debug)add().a('a','Перезагрузить расширение',{href:'#'}).addEventListener('click',e=>{
			chrome.runtime.sendMessage({type:'Reload'}); //todo: не всегда перезагружается
			if(!OPTIONS.enable_notifications) setTimeout(e=>window.location.reload(),1000);
			e.preventDefault()
		});
		if(OPTIONS.is_options_button){
			add().a('a','Настройки',{href:ext_url+('options.html'),target:'_blank'});
		}
		if (owner && OPTIONS.is_search) {
			let search = add();
			search.a('span','Поиск по моим вопросам/ответам:').a('br');
			search.a('input').addEventListener('keydown',e=>{
				if(e.key !== 'Enter' || !e.target.value) return;
				let w=window.open('https://www.google.com/search?q='+owner+'+'+encodeURIComponent(e.target.value).replace(' ','+')+' site:toster.ru/q/');
			});
		}
		if(OPTIONS.check_online){
			div_online=add().a('div',0,'online_box');
		}
		if(OPTIONS.read_q && Q) add().a('a','Очистить уведомления',{href:'#'}).addEventListener('click',e=>{
			chrome.runtime.sendMessage({type:'clearQuestion',q_id:Q});
			e.preventDefault()
		});
		aside.insertBefore(widget,aside.children[0]);
	} else {
		OPTIONS.check_online=0;
	}
}

//Добавляет пункты в главное меню
function AsideMenu() {
	//if (!(OPTIONS.show_my_questions || OPTIONS.show_my_answers)) return;
	if(mainmenu.all) mainmenu.all.a.addEventListener('click',e=>{
		let now = (new Date()).getTime();
		if (now-cache_page_1_tm < 25000 && DOM.page) { //Есть кешированная версия вопросов
			DOM.page.innerHTML = cache_page_1;
			found_first_q_id=cache_page_1_q;
			localStorage.qcnt_all = cache_page_1_q;
			parse_questions();
			g_status='all';
			e.preventDefault();
			document.body.scrollTop = document.documentElement.scrollTop = 0;
		}
	});
	if(mainmenu.myfeed) mainmenu.myfeed.a.addEventListener('click',e=>{
		let now = (new Date()).getTime();
		if (now-cache_my_feed_tm < 25000 && DOM.page) { //Есть кешированная версия вопросов
			DOM.page.innerHTML = cache_my_feed;
			found_first_q_id=cache_my_feed_q;
			localStorage.qcnt_feed = cache_my_feed_q;
			parse_questions();
			g_status='feed';
			e.preventDefault();
			document.body.scrollTop = document.documentElement.scrollTop = 0;
		}
	});
	//ниже старый код, не трогаем
	if(!owner) return log('logged out');
	let main_menus = d.querySelectorAll('.main-menu');
	let menu_item, main_menu, user_menu;
	let menu_arr = {};
	for(let i=main_menus.length-1;i>=0;i--){
		let item = main_menus[i].children[0];
		if (item) {
			if (item.innerText.trim() == 'Моя лента') {
				menu_item = item.nextElementSibling;
				main_menu = main_menus[i];
				for(let j=main_menu.children.length-1;j>=0;j--){
					let it = main_menu.children[j];
					if (it.classList.contains('main-menu__item')) {
						let name = it.innerText.trim();
						if (name != '') menu_arr[name] = it;
					}
				}
			}
			else if (item.innerText.trim() == 'Настройки') {
				user_menu = main_menus[i];
			}
		}
	}
	if (!menu_item) return log('Main menu not found.');
	if (OPTIONS.show_my_questions) {
		let e = menu_item.cloneNode(true);
		let a = e.children[0];
		if (a && a.tagName == 'A' && a.childNodes[2] && a.childNodes[2].nodeType == 3) {
			a.childNodes[2].nodeValue = 'Мои вопросы';
			a.href = 'user/'+owner+'/questions';
			main_menu.appendChild(e);
		}
	}
	if (OPTIONS.show_my_answers) {
		let e = menu_item.cloneNode(true);
		let a = e.children[0];
		if (a && a.tagName == 'A' && a.childNodes[2] && a.childNodes[2].nodeType == 3) {
			a.childNodes[2].nodeValue = 'Мои ответы';
			a.href = 'user/'+owner+'/answers';
			main_menu.appendChild(e);
		}
	}
	if (OPTIONS.show_my_comments) {
		let e = menu_item.cloneNode(true);
		let a = e.children[0];
		if (a && a.tagName == 'A' && a.childNodes[2] && a.childNodes[2].nodeType == 3) {
			a.childNodes[2].nodeValue = 'Мои комментарии';
			a.href = 'user/'+owner+'/comments';
			main_menu.appendChild(e);
		}
	}
	if (OPTIONS.show_my_likes) {
		let e = menu_item.cloneNode(true);
		let a = e.children[0];
		if (a && a.tagName == 'A' && a.childNodes[2] && a.childNodes[2].nodeType == 3) {
			a.childNodes[2].nodeValue = 'Мои лайки';
			a.href = 'user/'+owner+'/likes';
			main_menu.appendChild(e);
		}
	}
	if (OPTIONS.show_my_tags) {
		let e = menu_item.cloneNode(true);
		let a = e.children[0];
		if (a && a.tagName == 'A' && a.childNodes[2] && a.childNodes[2].nodeType == 3) {
			a.childNodes[2].nodeValue = 'Мои теги';
			a.href = 'user/'+owner+'/tags';
			main_menu.appendChild(e);
		}
	}
	if (!user_menu) return log('User submenu not found.');
	if (OPTIONS.hidemenu_all_tags) {
		let item = menu_arr['Все теги'];
		if (item) user_menu.a(item);
	}
	if (OPTIONS.hidemenu_all_users) {
		let item = menu_arr['Пользователи'];
		if (item) user_menu.a(item);
	}
	if (OPTIONS.hidemenu_all_notifications) {
		let item = menu_arr['Уведомления'];
		if (item) user_menu.a(item);
	}
}

const shortDesc = {
	'Автор вопроса':'Автор',
	'Отмечено решением':'Решение',
	'Отметить решением':'Мнение',
	'Нравится':'Лайк',
	'комментарий':'коммент', 'комментария':'коммента', 'комментариев':'комментов',
	'Комментировать':'Коммент',
}
let makeShort=s=>shortDesc[s]||s||'???';

//Сокращаем все названия, убираем мусор
function FilterCurator() {
	if (!OPTIONS.minify_curator) return;
	let spans = d.querySelectorAll('span.author_mark');
	for(let i=0;i<spans.length;i++) {
		let s = spans[i].innerText;
		if (s.indexOf('Куратор тега ') === 0) spans[i].innerText = s.substr(13);
		else if (shortDesc[s]) spans[i].innerText = shortDesc[s];
	}
}

function FilterDesc() {
	return; //Что-то плохо работает. Отключено.
	if(!OPTIONS.minify_names) return;
	d.querySelectorAll('span[data-voted-msg]').forEach(e=>{
		e.setAttribute('data-voted-msg', makeShort(e.getAttribute('data-voted-msg')));
		e.setAttribute('data-not-voted-msg', makeShort(e.getAttribute('data-not-voted-msg')));
		e.innerText = makeShort(e.innerText);
	});
	d.querySelectorAll('a.btn_like').forEach(e=>{
		let node = e.childNodes[0];
		if (!node || node.nodeType != 3) return;
		node.data = makeShort(node.data.trim());
	});
	d.querySelectorAll('a.btn_comments-toggle').forEach(e=>{ //btn btn_link btn_comments-toggle
		if(e.children[0] && e.children[0].tagName.toLowerCase() == 'span') e = e.children[0];
		let node;
		for(let i=e.childNodes.length-1;i>=0;i--) {
			if (e.childNodes[i].nodeType == 3 && e.childNodes[i].data.trim()) node = e.childNodes[i];
		}
		if (node) node.data = makeShort(node.data.trim());
	});
}

function RemoveTESpam() {
	if (!OPTIONS.remove_te_spam) return;
	let notices_container = sel('.flash-notices');
	if (notices_container) {
		let observer = new MutationObserver(function(mutationsList, observer) {
			for(var mutation of mutationsList) {
				if (mutation.type == 'childList') {
					//log('A child node has been added or removed.');
					for(let i=0;i<mutation.addedNodes.length;i++){
						let n = mutation.addedNodes[i];
						if (n.innerHTML.indexOf('Настройки Toster Extension изменены') > -1) {
							n.parentNode.removeChild(n);
						}
					}
				}
				else if (mutation.type == 'attributes') {
					//log('The ' + mutation.attributeName + ' attribute was modified.');
				}
				//else log('Mutation '+mutation.type );
				//log(mutation);
			}
		});
		observer.observe(notices_container, {
			attributes:true, childList:true, subtree:true, characterData:true,
		});
	}
}

function HideSolButton() {
	if (OPTIONS.hide_sol_button == 1) {
		let q = d.getElementsByClassName('buttons-group_answer');
		for(let i=0;i<q.length;i++) {
			let sol = q[i].querySelector('span.btn_solution');
			if (sol) sol.style.display = 'none';
		}
	} else if (OPTIONS.swap_buttons == 1) {
		let q = d.getElementsByClassName('buttons-group_answer');
		for(let i=0;i<q.length;i++) {
			let sol = q[i].querySelector('span.btn_solution');
			let like = q[i].querySelector('a.btn_like');
			if (sol && like) {
				q[i].insertBefore(like, sol);
			}
		}
	}
}

function DateTimeReplace() {
	if (OPTIONS.datetime_replace == 1) {
		let now = (new Date()).getTime();
		let t = d.getElementsByTagName('time');
		for(let i=0;i<t.length;i++) {
			let title = t[i].title;
			let datetime = t[i].dateTime;
			if (datetime && now - (new Date(datetime)).getTime() > OPTIONS.datetime_days * 24 * 60 * 60000) {
				if (title && title.indexOf('Дата публикации: ') > -1) t[i].innerHTML = title.substr(17);
			}
		}
	}
}

let OPTIONS = {};
// Change page according to options
function parse_opt() {
	let q = Q && {
		id: Q,
	};
	checkPoint('send options');
	chrome.runtime.sendMessage({
		type: "getOptions",
		q: q || 0,
	}, function(options) {
		checkPoint('got options');
		OPTIONS = options;
		sandbox(HideSolButton);
		if (options.show_habr == 1) {
			let q = d.getElementsByClassName('buttons-group_answer');
			for(let i=0;i<q.length;i++) {
				q[i].style.display = '';
			}
		}
		if (options.hide_offered_services == 1 || options.aside_right_noads == 1) {
			let q = d.getElementsByClassName('offered-services');
			for (let i=0;i<q.length;i++) {
				q[i].style.display = 'none';
			}
		}
		if (options.use_ctrl_enter == 1) sandbox(set_ctrl_enter_handler);
		if (options.save_form_to_storage == 1) sandbox(enable_save_form_to_storage);
		arr_on_options_callback.forEach(fn=>sandbox(fn));
		is_options_loaded = true;
		//Manage notifications
		if (options.enable_notifications == 1) sandbox(initNotifications);
		sandbox(DateTimeReplace);
		//Aside filters
		sandbox(AsideRightFilters);
		//Aside menu
		sandbox(AsideMenu);
		sandbox(FilterCurator);
		sandbox(RemoveTESpam);
		sandbox(FilterDesc);
		checkPoint('did options');
	});
}

function addCustomCSS(css) {
	let pt = d.head || d.children[0];
	let e = css.substr(0,4) == 'http'? c('link',0,{rel:'stylesheet',type:'text/css',href:css}) : c('style',css);
	pt.a(e);
}
function removeCustomCSS(css) {
	let arr = d.getElementsByTagName('style');
	for (let i=0, max = arr.length; i < max; i++) {
		if (arr[i].innerText == css) {
			arr[i].parentNode.removeChild(arr[i]);
			break;
		}
	}
}

const NAMES = {
	'question question_full':'tfull', 'question__additionals':'rest',
	'question-head':'head', 'question__tags':'tags', 'question__title':'title', 'question__body':'body',
	'question__comments-link':'coml', 'buttons-group_question':'btn', 'question__comments':'com',
	'user-summary_question':1,
	'user-summary__avatar':'avatar', 'user-summary__desc':'desc',
	'user-summary__name':'name', 'user-summary__nickname':'nick', 'user-summary__about':'about',
	'question__text':'text', 'question__attrs':'attr',
};
const DOM = {};
function getDOM(obj,el,names) { //Вынимает из el объекты с классами из names и кладёт в obj под именами из NAMES
	for(let i=el.children.length-1;i>=0;i--) {
		let e=el.children[i],optional;
		let name = names.pop();
		if (name===0) {
			optional = true;
			name = names.pop();
		}
		if(!name)break;
		if(e.className.indexOf(name)===-1) {
			log('Warning! Wrong order for element:',name);
			e = el.querySelector('.'+name); //slow
			if(!e) {
				if (optional) e = '';
				else return log('Unknown element:',el.children[i].className,'Need:',name);
			}
		}
		if(!obj)return e;
		name=NAMES[name] || name;
		obj[name]=e;
	}
	if(names.length>0){
		log('Warning! Not finished:',names);
		let bad = names.find(n=>!(obj[NAMES[n]||n]=el.querySelector('.'+n)));
		if(bad)return log('Element not found:',bad);
	}
	return obj;
}
function getUL(obj,el,cls,names) {
	for(let i=el.children.length-1;i>=0;i--) {
		let e=el.children[i];
		if(e.className.indexOf(cls)===-1)log('Warning! Wrong class in UL:',e.className,'Need:',cls);
		let name = names.pop();
		if(!name)return log('Кончились имена для UL:',el);
		obj[name] = e;
	}
	if(names.length)log('Warning! Лишние имена для UL:',names);
	return obj;
}
function parseDOM_question(Q) {
	//https://toster.ru/q/630303
	let rest,n;
	if(!(DOM.show = did('question_show'))) return log('No content area!');
	if(!getDOM(DOM,DOM.show,['question question_full', 'question__additionals'])) return;
	if(!getDOM(DOM,DOM.tfull,['question-head', 'question__tags', 'question__title',
		'question__body', 'question__comments-link', 'buttons-group_question', 'question__comments'])) return;
	DOM.title = DOM.title.innerText;
	if(!(DOM.qsum = getDOM(0,DOM.head,['user-summary_question']))) return log('No summary!');
	if(!(DOM.qsum = getDOM({},DOM.qsum,['user-summary__avatar', 'user-summary__desc']))) return;
	if(n=DOM.qsum.avatar.querySelector('img')) DOM.qsum.avatar = n.src; else {DOM.qsum.avatar=''; log('No avatar!'); }
	if(!(DOM.qsum.desc = getDOM({},DOM.qsum.desc,['user-summary__name', 'user-summary__nickname', 'user-summary__about',0]))) return;
	if(!(DOM.body=getDOM({},DOM.body,['question__text', 'question__attrs']))) return;
	if(!getUL(DOM.body,DOM.body.attr,'inline-list__item',['pubdate','views'])) return;
	if(n=DOM.body.pubdate.querySelector('time')) DOM.body.pubdate=n.dateTime; else return log('No post time!');
	if(n=DOM.body.views.querySelector('.question__views-count')) DOM.body.views=parseInt(n.innerText); else return log('No views!');
	return true;
}
function parseDOM_mainmenu() {
	d.querySelectorAll('ul.main-menu').forEach(mm=>{
		mm.querySelectorAll('li.main-menu__item').forEach(e=>{
			let a = e.children[0]; if(a.tagName!='A')return console.log('No link');
			let name = a.innerText.trim();
			if (name == "Моя лента") mainmenu.myfeed = {e:e,a:a};
			else if (name == "Все вопросы") mainmenu.all = {e:e,a:a};
		});
	});
	DOM.mainmenu = mainmenu;
	return true;
}
function parseDOM_getNickname(){
	let user_side = sel('.user-panel__side');
	if(user_side){
		let a = user_side.children[0]
		if(a && a.tagName=='A' && a.className=='user-panel__user-name'){
			let m = a.href.match(/https?:\/\/toster\.ru\/user\/([^\/?"]*)/);
			if(m) owner = m[1];
		}
	}
}


//анализируем страницу полностью
function parseDOM() {
	DOM.page=sel('div.page');
	sandbox(parseDOM_getNickname);
	sandbox(parseDOM_mainmenu);
	let m = location.href.match(/^https?:\/\/toster\.ru\/(.*)$/);
	if (!m) return log('Wrong URL:',location.href);
	URL = m[1];
	if(m = URL.match(/^q\/(\d\d+)/)){
		Q = m[1]-0;
		return parseDOM_question(Q);
	}
	return true;
}

//Функция получает список субъективных оценок и применяет к списку пользователей (меню все пользователи).
function ParseUserList() {
	if (!OPTIONS.show_psycho) return;
	//Формируем список пользователей.
	let cards = [...d.querySelectorAll('.card')].filter(e=>e.querySelector('.card__head_user') && true || false);
	if (cards.length != 30) log('User cards = '+cards.length);
	let users = {}; // nick:el
	let nicknames = [];
	cards.forEach(e=>{
		let a = e.querySelector('h2.card__head-title > a');
		if (!a) return;
		if (a.href.indexOf("https://toster.ru/user/") !== 0) return;
		let nick = a.href.substr(23).trim();
		if(nick=='') return;
		nicknames.push(nick);
		users[nick] = e;
	});
	//Получаем данные о них.
	chrome.runtime.sendMessage({
		type: "getHints",
		nicknames: nicknames,
	}, function(data) {
		for(let nick in users) {
			let e = users[nick];
			let head = e.querySelector('.card__head_user');
			head.style.minHeight = '145px';
			let info = e.querySelector('.card__head-subtitle');
			let o = data[nick];
			if(!o)o={hint:'',note:''};
			let myhint=c('div',null,{class:'user-summary-comfort',style:'height:20px;font-size:16px;line-height:14px'});
			let t = myhint.a('span',o.hint,{style:'font-weight:bold; color:#a9bb1e;','data-psycho':o.note,'data-user':nick});
			let h = 16;
			let check_id = o.hint && setInterval(()=>{
				let divHeight = t.offsetHeight;
				if (divHeight <= 20 || h < 5) return clearInterval(check_id);
				h--;
				myhint.style.fontSize = h + 'px';
			},0);
			if (info) {
				head.insertBefore(myhint,info);
			} else { //no info
				head.a(myhint);
			}
		}
	});
}


d.addEventListener('DOMContentLoaded', e=>{ // <------------ !!!!!
	checkPoint('<--- LOAD EVENT');
	if(!parseDOM()) checkPoint('DOM parse error!'); else checkPoint('DOM loaded.');
	//log('DOM:',DOM);
	parse_opt();
	addCustomCSS(css_global);
	//if (URL.indexOf('user/')===0 && !URL.match(/^user\/[^\/]+/iquestions/)
	if (URL.indexOf('q/') === 0 || URL.indexOf('answer') === 0) {
		sandbox(parse_q);
		g_status = 'q';
		checkPoint('question parsed');
	}
	else {
		if (!URL.match(/^user\/.*\/questions/)) listenOnOptions(parse_questions);
		if (URL=='questions')g_status='all';
		if (URL=='my/feed')g_status='feed';
		if (URL=='users' || URL.indexOf('users/main')===0) {
			g_status='userlist';
			listenOnOptions(ParseUserList);
		}
	}
	document.body.a('div',0,{id:'toster-comfort-sign'}).style.display = 'none';
});

const css_right_hide = '.column_sidebar { visibility: hidden; }';
if (fixFirefox) addCustomCSS(css_right_hide);

const css_global = `
.dot_sub {
  height: 14px;
  width: 14px;
  background-color: #44f;
  border-radius: 50%;
  display: inline-block;
}
.dot_sb {
  height: 14px;
  width: 14px;
  background-color: #aaf;
  border-radius: 50%;
  display: inline-block;
}
.norma {
	font-size:13px;
	font-weight:normal;
}
.tc_new {
	color: red;
	font-weight: bold;
	background-color: #ff0;
}
.online_box{
	padding-top:4px;
}

.comfortTooltip {
	position: fixed;
	padding: 10px 20px;
	border: 1px solid #b3c9ce;
	border-radius: 10px;
	font: italic 14px/1.3 sans-serif;
	color: #000;
	background: #ebffcc;
	white-space: pre-wrap;
	max-width: 400px;
	z-index: 999999;
	box-shadow: 3px 3px 3px rgba(0, 0, 0, .3);
}
`;

function sandbox(fn) {
	try { return fn(); } catch(e) {
		log('Ошибка в функции: ',fn.name);
		log(e);
	}
}

checkPoint('script done');
let fn_test = e=>{ //debug
	checkPoint('debug');
	if (sel('div#dfp_target')) log('Found!!!',sel('div#dfp_target').innerHTML.length);
};
let test1 = 0;
let timer1;// = setInterval(fn_test,5);

//Go online

const random_answer = 1283582; //1282990;

//let skip_err_max=0,skip_err_cnt=0;
function checkOnlineUsers() {
	let xhr = new XMLHttpRequest();
	let url = 'https://toster.ru/answer/likers_list?answer_id='+random_answer;
	xhr.open('POST', url, true);
	xhr.send('');
	xhr.onload = function() {
		//console.log(xhr.status,xhr.responseText.length);
		if(xhr.status!=200)return;
		let imgs={};
		let a = xhr.responseText.match(/<img src="https?:\/\/habrastorage\.org\/[^"]+" alt="[^"]+/g);
		if(a)a.forEach(s=>{
			let m=s.match(/<img src="https?:\/\/habrastorage\.org\/([^"]+)" alt="([^"]+)/);
			imgs[m[2]]=clearString(m[1]);
		});
		
		let users = {};
		a = xhr.responseText.match(/<a class="user-summary__name" href="https?:\/\/toster\.ru\/user\/[^"]+">/g);
		if(a)a.forEach(s=>{
			let m=s.match(/user\/([^"]+)">/);
			let nick=clearString(m[1]);
			let user = {nick:nick};
			if (imgs[nick])user.img=imgs[nick];
			users[nick]=user;
		});
		chrome.runtime.sendMessage({type: "checkOnline", obj: users});
	}
}

//let skip_err_max=0,skip_err_cnt=0;
function voteOnline(act) {
	if(!owner || owner=='dollar')return;
	let xhr = new XMLHttpRequest();
	let url = 'https://toster.ru/answer/'+(act==1?'like':'cancel_like')+'?answer_id='+1282990;
	xhr.open('POST', url, true);
	xhr.send();
}

let cached_user_tags = {}

//Анализ тегов пользователя (по требованию)
function addTagsGraph(el,nick) {
	let timer;
	let cnt = 0;
	const max_count = 150; //30 seconds
	function checkUser() {
		function drawGraph(data) {
			if(!data)return;
			cached_user_tags[nick]=data;
			if (data.cnt === 0) {
				el.a('br');
				el.a('span').a('b','Нет интересов.');
			} else {
				el.a('br');
				el.a('span').a('b','Интересы:');
				//tags
				for(let i=0;i<data.cnt;i++) {
					let t = data.tags[i];
					el.a('br');
					el.a('span',t.name + ' ('+t.honor+')').style.color = '#a98ae7';
				}
			}
			//graph
			function addCanvas(max) {
				//el.a('br');
				const HEIGHT = 100;
				let ctx = el.a('canvas', 0, {width:'350px',height:HEIGHT+'px'}).getContext('2d');
				const FLOOR = HEIGHT - 10;
				const LEVEL = FLOOR - 10;
				const MAX_VALUE = data.tags[0].honor;
				function getY(honor) {
					return Math.round(FLOOR - LEVEL * (honor / MAX_VALUE));
				}
				let LEFT = 10;
				const WIDTH = -LEFT + (350-10);
				const DELTA = WIDTH / max;
				//ctx.beginPath();
				//Координатная сетка
				ctx.beginPath();
				ctx.strokeStyle = 'rgb(150, 150, 150)';
				ctx.lineWidth = 1;
				ctx.moveTo(LEFT + 0.5, FLOOR - LEVEL - 5);
				ctx.lineTo(LEFT + 0.5, FLOOR - 0.5);
				ctx.lineTo(LEFT + WIDTH + 5, FLOOR - 0.5);
				ctx.stroke();
				ctx.font = '10px Arial';
				//Сам график
				ctx.beginPath();
				ctx.strokeStyle = 'rgb(200, 0, 200)';
				ctx.lineWidth = 3;
				ctx.moveTo(LEFT, FLOOR - LEVEL);
				for(let i =1;i<=max;i++) {
					//log(i,data.tags,data.tags[i])
					ctx.lineTo(LEFT + Math.floor(DELTA * i), getY(data.tags[i].honor));
					if (i==5) {
						ctx.stroke();
						ctx.beginPath();
						ctx.strokeStyle = 'rgb(250, 150, 250)';
						ctx.moveTo(LEFT + Math.floor(DELTA * i), getY(data.tags[i].honor));
					}
				}
				ctx.stroke();
				ctx.strokeStyle = 'rgb(160, 160, 160)';
				ctx.lineWidth = 0.5;
				ctx.fillStyle = 'rgb(200, 0, 200)';
				let LAST_GREEN_X;
				let cc = []; //Координаты точек
				for(let i =0;i<=max;i++) {
					let cx = LEFT + Math.floor(DELTA * i);
					let cy = getY(data.tags[i].honor);
					cc[i] = {x:cx,y:cy};
					if (!LAST_GREEN_X && data.tags[i].honor < 100) {
						LAST_GREEN_X = cx - 7;
						if (i>0) LAST_GREEN_X = LEFT + Math.floor(DELTA * (i-1) - DELTA * 0.5);
					}
					if(i>0) {
						ctx.beginPath();
						ctx.moveTo(cx + 0.5, FLOOR + 3);
						ctx.lineTo(cx + 0.5, Math.max(10, cy - 25));
						ctx.stroke();
					}
					ctx.fillRect(cx-3, cy-3, 6, 6);
					if (i==5) ctx.fillStyle = 'rgb(250, 150, 250)';
				}
				//Зеленая линия
				if (MAX_VALUE > 100) {
					if (!LAST_GREEN_X) LAST_GREEN_X = LEFT + WIDTH - 5;
					else if (LAST_GREEN_X < LEFT + 10) LAST_GREEN_X = LEFT + 10;
					else if (LAST_GREEN_X > 340) LAST_GREEN_X = 340;
					const GREEN_LINE_Y = FLOOR - (100 / MAX_VALUE) * LEVEL
					ctx.strokeStyle = 'rgb(0, 255, 0)';
					ctx.lineWidth = 0.5;
					ctx.beginPath();
					ctx.moveTo(LEFT + 5, GREEN_LINE_Y);
					ctx.lineTo(LAST_GREEN_X, GREEN_LINE_Y);
					ctx.stroke();
					ctx.font = '8px Arial';
					ctx.fillStyle = 'rgb(0, 128, 0)';
					ctx.fillText('100', 0, GREEN_LINE_Y);
				}
				//Подписи
				ctx.font = '10px Arial';
				ctx.fillStyle = 'rgb(0, 0, 0)';
				let px = new Array(HEIGHT).fill(0);
				function checkSpace(cx,cy,w,n) { //проверяет, есть ли место для текста
					if (cy < 7 || cy > HEIGHT -1) return false;
					if (n < max) { 
						let dy = ((cc[n+1].y - cc[n].y) / DELTA) * 4;
						if (cc[n].y + dy - 2 < cy && cc[n].y + dy + 2 > cy - 8) return false;
					}
					let min = Math.max(cy-8,0);
					for (let y=cy;y>=min;y--) {
						if (px[y] > cx) return false;
					}
					for (let i=n+1;i<max;i++) {
						if (cc[i].x + 3 > cx + w) return true;
						if (cc[i].y - 3 < cy && cc[i].y + 3 > cy - 8) return false;
					}
					return true;
				}
				for(let i =0;i<=max;i++) {
					let cx = cc[i].x+3;
					let cy = cc[i].y;
					let text = data.tags[i].name;
					let w = ctx.measureText(text).width;
					if (cx + w > 350) continue;
					let y = 0;
					while (!checkSpace(cx,cy+y,w,i)) {
						if (y>15) {
							y=-100;
							break;
						}
						if (checkSpace(cx,cy-y,w,i)) {
							y = -y;
							break;
						}
						y++;
					}
					if (y === -100) continue;
					ctx.fillText(text, cx, cy + y);
					for(let yy=Math.max(0,cy+y-8); yy < cy+y; yy++) {
						if (yy>=0) px[yy] = cx + w;
					}
					//ctx.fillRect(0, cy+y, cx + w, 8);
				}
				//log(px)
			}
			let max = Math.min(data.tags.length-1, 5);
			if (data.tags.length > 3 || data.tags.length > data.cnt) { //small graph
				addCanvas(max);
			}
			if (data.tags.length > 6 && max / data.tags.length < 0.7) { //big graph
				addCanvas(data.tags.length - 1);
			}
		}
		if (cached_user_tags[nick]) {
			cnt = max_count;
			if (timer) clearInterval(timer);
			drawGraph(cached_user_tags[nick]);
			return;
		}
		chrome.runtime.sendMessage({
			type: "analyzeUserTags",
			nickname: nick,
		}, function(data) {
			function checkData() {
				if (!el.parentNode) return; //already hidden
				if (cached_user_tags[nick]) return; //already drawn
				if (data.cnt === -1) return false; //waiting
				return data;
			} //log('check',checkData())
			if (checkData() !== false) {
				if (timer) clearInterval(timer);
				if (data.cnt >= 0) drawGraph(data);
			} else cnt++;
			if (cnt >= max_count && timer) clearInterval(timer);
		});
	}
	checkUser();
	if (cnt < max_count) timer = setInterval(checkUser,200);
}


//Всплывающая подсказка
let saveTooltip;
d.addEventListener("mouseover", e=>{
	let t = e.target;
	let tooltipHtml = t.getAttribute('data-psycho');
	if (!tooltipHtml) return;

	saveTooltip = c('div');
	saveTooltip.className = 'comfortTooltip';
	if (tooltipHtml[0] == ' ') saveTooltip.style.backgroundColor = '#dc825a';
	else if (tooltipHtml[0] == '#') {
		tooltipHtml = tooltipHtml.substr(1);
		saveTooltip.style.backgroundColor = '#ddeeff';
	}
	saveTooltip.innerText = tooltipHtml;
	d.body.a(saveTooltip);
	if (OPTIONS.psycho_tags) {
		let nickname = t.getAttribute('data-user');
		if (nickname) {
			addTagsGraph(saveTooltip,nickname);
		}
	}

	let coords = t.getBoundingClientRect();

	let left = coords.left + 50; // + 150 + (t.offsetWidth - saveTooltip.offsetWidth) / 2;
	if (left < 0) left = 0; 

	let top = coords.top - saveTooltip.offsetHeight - 3;
	if (top < 0) top = coords.top + t.offsetHeight + 3;
	
	if (top + saveTooltip.offsetHeight > window.innerHeight) { // Даже внизу не влезает, надо смещать вправо, там есть место.
		left = coords.right + 3;
		top = 3;
	}

	saveTooltip.style.left = left + 'px';
	saveTooltip.style.top = top + 'px';
});

d.addEventListener("mouseout", e=>{
	if (saveTooltip) {
		saveTooltip.remove();
		saveTooltip = null;
	}
});




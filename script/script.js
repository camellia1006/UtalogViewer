import { Debug, DataTable, MessageField } from './class.js';
import { Helper, once, debounce, createChild } from './helper.js';

/** @type {DataTable | null} */
let table;
/** @type {boolean} */
let autoPlay = false;

const appInit = once(async () => {
	Debug.startLabel();

	const response = await fetch('./script/singers.json');
	const singers = await response.json();

	const params = new URLSearchParams(location.search);
	/** @type {string[]} */
	const keys = ['id', 'name'];
	const values = keys.map(key => params.get(key));
	const singer = keys
		.map((key, i) => values[i] && singers.find(s => s[key] === values[i]))
		.filter(Boolean)[0];
	if (!singer) return MessageField.show('データが指定されていません');

	table = new DataTable(Helper.elements.tableContainer, singer);
	autoPlay = Boolean(Number(params.get('autoplay')) || 0);

	setupEventListeners();
	Helper.setupSocialLinks(singer);
	Helper.setupTableSelect(singer);

	MessageField.show('読み込み中', {dots: true});
	await table.draw(singer.tables[0]);
	Helper.elements.rowCount.textContent = table.filter('');

	Helper.showElements('socialLinks', 'tableSelect', 'videoContainer', 'actionBar');
	MessageField.hide();
});

const initMgr = new Proxy(
	{
		dom: false,
		load: false
	},
	{
		set(target, key, value) {
			Debug.startLabel(key,value);
			target[key] = value;
			if (Object.values(target).every(v => v)) appInit();
			return true;
		}
	}
);

function setupEventListeners() {
	Debug.startLabel();
	Helper.elements.tableSelect?.addEventListener(
		'change', 
		onRadioChange
	);
	Helper.elements.searchBox?.addEventListener(
		'input', 
		debounce(onSearchInput, 300)
	);
	Helper.elements.toggleLayout?.addEventListener(
		'click',
		onToggleLayoutClick
	);
	Helper.elements.tableContainer?.addEventListener(
		'click',
		onTableClick
	);
	Helper.elements.videoContainer?.addEventListener(
		'transitionend',
		(e) => {
			if (e.target.classList.contains('closed')) return;
			table.getHighlight()?.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
		}
	);
}

async function onRadioChange(event) {
	Debug.startLabel(event);
	MessageField.show('読み込み中', {dots: true})
	await table.draw(event.target.value);

	MessageField.hide();
	Helper.elements.searchBox.dispatchEvent(new Event('input'));
}

function onSearchInput(event) {
	Debug.startLabel(event.target);
	const hit = table.filter(event.target.value)
	Helper.elements.rowCount.textContent = hit;
}

function onToggleLayoutClick(event) {
	Debug.startLabel();
	const videoContainer = Helper.elements.videoContainer;

	videoContainer.classList.toggle('closed');
	event.target.textContent = videoContainer.classList.contains('closed') ? 'ビデオを表示' : 'リストを拡大';
}

function onTableClick(event) {
	Debug.startLabel();
	switch(event.target.tagName) {
		case 'TH':
			table.sort(event.target);
			break;
		case 'TD':
			const tr = event.target.closest('tr');
			const url = tr.dataset.url;

			table.highlight(tr);
			Helper.setVideoUrl(url, autoPlay);
			break;
	}
}

document.addEventListener('DOMContentLoaded', () => {
	MessageField.init();
	MessageField.show('初期化中', {dots:true});
	initMgr.dom = true;
	
	Helper.setDebugMode(new URLSearchParams(location.search));
});

window.onload = () => initMgr.load = true;
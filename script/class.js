import { createChild } from "./helper.js";

export class Debug {
	static levels = { NONE: 0, ERROR: 1, WARN: 2, INFO: 3, LOG: 4 };
	static #level = Debug.levels.NONE;
	static #innerLog = [];

	static error(...args) {
		Debug.#addLog(args);
		if (this.#level >= Debug.levels.ERROR) console.error(...args);
	}

	static warn(...args) {
		Debug.#addLog(args);
		if (this.#level >= Debug.levels.WARN) console.warn(...args);
	}

	static info(...args) {
		Debug.#addLog(args);
		if (this.#level >= Debug.levels.INFO) console.info(...args);
	}

	static log(...args) {
		Debug.#addLog(args);
		if (this.#level >= Debug.levels.LOG) console.log(...args);
	}

	static time(label='default') {
		if (this.#level >= Debug.levels.INFO) console.time(label)
	}

	static timeEnd(label='default') {
		if (this.#level >= Debug.levels.INFO) console.timeEnd(label);
	}

	/**
	 * @param {string} label 
	 * @param {Function} fn 
	 * @param {...any} args 
	 */
	static measure(label, fn, ...args) {
		Debug.time(label);
		try {
			return fn(...args);
		} finally{
			Debug.timeEnd(label);
		}
	}

	static startLabel(...args) {
		if (this.#level < Debug.levels.INFO) return;

		const caller = new Error().stack?.split('\n')[2].trim() ?? 'unknown';
		let label = `Start ${caller}`;

		if (this.#level === Debug.levels.INFO) {
			Debug.info(label); // infoでは引数の表示なし
			return;
		}

		if (args.length) label += `\nargs: `;
		Debug.log(label, ...args);
	}

	static scan(arg, label='Scan') {
		Debug.log(`${label}:`, arg);
		return arg;
	}

	static #addLog(args) {
		Debug.#innerLog = [...Debug.#innerLog, args].slice(-30);
	}

	static logOutput() {
		MessageField.showList(
			Debug.#innerLog
				.map((row, i) => `#${i + 1} ${Array.isArray(row) ? row.join(' ') : row}`), 
			{closable: true}
		);
	}

	/** @param {number} level  */
	static setLevel(level) {
		Debug.#level = level;
	}
}

/**
 * @typedef {Object} TableState
 * @property {HTMLTableElement} element
 * @property {{
 * 	colIndex: number,
 * 	ascending: boolean
 * }} sort
 */

export class DataTable {
	/** @type {HTMLDivElement} */
	#container = null;
	/** @type {Object.<string, TableState>} */
	#tables = {};
	/** @type {TableState|null} */
	#current = null;
	#singer = null;

	/**
	 * @param {HTMLDivElement} div
	 * @param {object} singer
	 */
	constructor(div, singer) {
		this.#container = div;
		this.#singer = singer;
	}

	/** @param {string} [tableName='general']  */
	async draw(tableName='general') {
		Debug.startLabel(tableName);
		if (!this.#tables[tableName]) {
			this.#tables[tableName] = {
				element: null,
				sort: {colIndex: -1, ascending: true}
			};
		}

		this.#current = this.#tables[tableName];

		if (!this.#current.element) await this.#loadTable(tableName);

		this.#container.replaceChildren(this.#current.element);
	}

	/**
	 * @param {string} text
	 * @returns {number} 
	 */
	filter(text) {
		Debug.startLabel(text);
		const lower = text.toLowerCase();
		let hit = 0;

		for (const row of this.#current.element.tBodies[0].rows) {
			let match = false;
			for (const cell of row.cells) {
				if (cell.textContent.toLowerCase().includes(lower)) {
					match = true;
					break;
				}
			}

			row.hidden = !match;
			match && hit++;
		}

		return hit;
	}

	/** @param {HTMLTableCellElement} col */
	sort(col) {
		Debug.startLabel(col);
		const headers = Array.from(this.#current.element.tHead.rows[0].cells); // table > thead > tr > th[]
		const colIndex = headers.indexOf(col);
		const ascending = this.#current.sort.colIndex === colIndex
			? !this.#current.sort.ascending
			: true;

		this.#current.sort = {colIndex, ascending};

		const tbody = this.#current.element.tBodies[0];
		const items = Array.from(tbody.rows) // tbody > tr[]
			.map(row => ({row, text: row.cells[colIndex].textContent || ''}));

		items.sort((a, b) => ascending 
				? a.text.localeCompare(b.text, undefined, {numeric: true})
				: b.text.localeCompare(a.text, undefined, {numeric: true})
		);

		tbody.replaceChildren(...items.map(item => item.row));
		headers.forEach(th => th.classList.remove('ascending', 'descending'));
		col.classList.add(ascending ? 'ascending' : 'descending');
	}

	/** @param {HTMLTableRowElement} row  */
	highlight(row) {
		this.#current.element
			.querySelectorAll('tr.highlight')
			.forEach(tr => tr.classList.remove('highlight'));
		row.classList.add('highlight');
	}

	/** @returns {HTMLTableRowElement | null} */
	getHighlight() {
		return this.#current.element.querySelector('tr.highlight');
	}

	/** @param {string} tableName  */
	async #loadTable(tableName) {
		Debug.startLabel(tableName);
		Debug.time(`load ${tableName}`);

		const url = `https://docs.google.com/spreadsheets/d/${this.#singer.sheetId}/gviz/tq?sheet=${encodeURIComponent(`#${tableName}`)}`;
		const response = await fetch(url)
		if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

		const text = await response.text();
		const match = text.match(/setResponse\(([\s\S]+)\);/);
		Debug.timeEnd(`load ${tableName}`);
		if (!match) throw new Error('Invalid response');

		const table = JSON.parse(match[1]).table;

		this.#tables[tableName].element = this.#createTable(table);

		return true;
	}

	/**
	 * @param {{
	 * 	cols: { label: string }[],
	 * 	rows: { c: ({ v: *, f?: string } | null)[] }[]
	 * }} table
	 * @returns {HTMLTableElement}
	 */
	#createTable(table) {
		const element = document.createElement('table');
		element.border = 1;

		{ // ヘッダー
			const thead = createChild(element, 'thead');
			const tr = createChild(thead, 'tr');

			for (const col of table.cols.slice(0, -1)) {
				const th = createChild(tr, 'th');
				th.textContent = col.label;
			}
		}

		{ // ボディ
			const tbody = createChild(element, 'tbody');
			const protocols = new Set(['http:', 'https:']);

			for (const row of table.rows) {
				const tr =createChild(tbody, 'tr');
				const urlCol = row.c.at(-1);
				tr.dataset.url = urlCol?.v ?? '';

				for (const cell of row.c.slice(0, -1)) {
					
					const td = createChild(tr, 'td');
					const text = String(cell?.f ?? cell?.v ?? '');
					const url = URL.parse(text);

					if (!url || !protocols.has(url.protocol)) {
						td.textContent = text;
						continue;
					}

					const anchor = createChild(td, 'a');
					Object.assign(anchor, {
						textContent: url.hostname,
						href: url.href,
						target: '_blank',
						rel: 'noopener noreferrer'
					});
				}
			}
		}

		return element;
	}
}

class DotsIndicator {
	#span = null;
	#timer = null;
	#count = -1;
	
	constructor(interval = 500) {
		this.#span = document.createElement('span');
		this.#timer = setInterval(() => this.#tick(), interval);
	}

	#tick() {
		if (!this.#span?.isConnected) return this.end();

		this.#count = this.#count % 3 + 1;
		this.#span.textContent = '.'.repeat(this.#count);
	}

	end(text='...') {
		if (!this.#timer) return;

		clearInterval(this.#timer);
		this.#timer = null;

		const node = document.createTextNode(text);
		this.#span.replaceWith(node);
		this.#span = null;
	}

	get element() {
		return this.#span;
	}
}

export const MessageField = (() => {
	/** @type { HTMLDivElement | null } */
	let dom = null;
	const clear = () => dom?.replaceChildren();
	/** @param {HTMLElement} container */
	const appendCloseButton = (container) => {
		const button = createChild(container, 'button');
		Object.assign(button, {
			type: 'button',
			textContent: '閉じる',
			onclick: clear
		});
	};
	return {
		init() {
			dom = document.getElementById('messageField');
		},
		/**
		 * 
		 * @param {string} message 
		 * @param {{
		 * 	closable?: boolean,
		 * 	dots?: boolean
		 * }} param1 
		 */
		show(message, {closable=false, dots=false}={}) {
			const fragment = document.createDocumentFragment();
			const field = createChild(fragment, 'p');
			field.textContent = message;

			if (dots) field.appendChild(new DotsIndicator().element);

			if (closable) appendCloseButton(fragment);

			dom?.replaceChildren(fragment);
		},
		/**
		 * 
		 * @param {Iterable<string>} messages 
		 * @param {{closable?: boolean}} param1 
		 */
		showList(messages, {closable=false}={}) {
			const fragment = document.createDocumentFragment();
			const field = createChild(fragment, 'ul');

			for (const msg of messages) {
				const li = createChild(field, 'li');
				li.textContent = msg;
			}

			if (closable) appendCloseButton(fragment);

			dom?.replaceChildren(fragment);
		},
		hide: clear
	}
})()
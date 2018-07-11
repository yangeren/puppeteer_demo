const mongoose = require('mongoose');
const User = require('./user');
// get the github 'join' users name and email data 
const puppeteer = require('puppeteer')

async function run() {
	const browser = await puppeteer.launch({
		headless: false
	});
	const page = await browser.newPage();

	await page.goto('https://github.com/login');
	await page.screenshot({ path: 'github.png' });

	const USERNAME_SELECTOR = '#login_field';
	const PASSWORD_SELECTOR = '#password';
	const BUTTON_SELECTOR = '.btn';

	const CREDS = require('./creds');

	await page.click(USERNAME_SELECTOR);
	await page.keyboard.type(CREDS.username);

	await page.click(PASSWORD_SELECTOR);
	await page.keyboard.type(CREDS.password);

	await page.click(BUTTON_SELECTOR);

	await page.waitForNavigation();

	const searchUrl1 = 'https://github.com/search?utf8=%E2%9C%93&q=&type='
	const userToSearch = 'join';
	const searchUrl = `https://github.com/search?q=${userToSearch}&type=Users&utf8=%E2%9C%93`;

	const LIST_USERNAME_SELECTOR = '#user_search_results > div.user-list > div:nth-child(INDEX) > div.d-flex > div > a'
	const LIST_EMAIL_SELECTOR = '#user_search_results > div.user-list > div:nth-child(INDEX) > div.d-flex > div > ul > li:nth-child(2) > a'
	const LENGTH_SELECTOR_CLASS = 'user-list-item';

	await page.goto(searchUrl);

	let listLength = await page.evaluate((sel) => {
		return document.getElementsByClassName(sel).length;
	}, LENGTH_SELECTOR_CLASS);

	await page.waitFor(2);
	// console.log(document.getElementsByClassName('user-list-item').length);
	console.log(searchUrl);
	console.log(listLength);




	async function getNumPages(page) {
		const NUM_USER_SELECTOR = '#js-pjax-container > div > div > div.column.three-fourths.codesearch-results > div > div.d-flex.flex-justify-between.border-bottom.pb-3 > h3'

		let inner = await page.evaluate((sel) => {
			let html = document.querySelector(sel).innerHTML;

			return html.replace(',', '').replace('user', '').trim();
		}, NUM_USER_SELECTOR);

		let numUsers = parseInt(inner);

		console.log('numUsers: ', numUsers);

		let numPages = Math.ceil(numUsers / 10);
		return numPages;

	}

	let numPages = await getNumPages(page);
	console.log('Numpages: ', numPages);
	if (numPages > 100) {
		numPages = 100;
		console.log("in the const!")
	}
	console.log("The new page is: ", numPages);

	for (let h = 1; h <= numPages; h++) {
		
		let pageUrl = searchUrl + '&p=' + h;

		await page.goto(pageUrl);

		let listLength = await page.evaluate((sel) => {
			return document.getElementsByClassName(sel).length;
		}, LENGTH_SELECTOR_CLASS);



		for (let i = 1; i <= listLength; i++) {
			let usernameSelector = LIST_USERNAME_SELECTOR.replace("INDEX", i);
			let emailSelector = LIST_EMAIL_SELECTOR.replace("INDEX", i);

			let username = await page.evaluate((sel) => {
				return document.querySelector(sel).getAttribute('href').replace('/', '');		
			}, usernameSelector);

			let email = await page.evaluate((sel) => {
				let element = document.querySelector(sel);
				return element? element.innerHTML: null;
			}, emailSelector);

			if (!email) {
				continue;
			}

			console.log(username, ' -> ', email);

			// TODO save this users
			upsertUser({
			  username: username,
			  email: email,
			  dateCrawled: new Date()
			});
		}
	}

	function upsertUser(userObj) {
		const DB_URL = 'mongodb://localhost/thal';

		if (mongoose.connection.readyState == 0) {
			mongoose.connect(DB_URL);
		}

		const conditions ={ email: userObj.email };
		const options = { upsert: true, new: true, setDefaultOnInsert: true};

		User.findOneAndUpdate(conditions, userObj, options, (err, result) => {
			if (err) {throw err};
		});
	}

	browser.close();
}

run();
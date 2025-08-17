module.exports = async (req, res) => {
	try {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ ok: true, method: req.method, url: req.url }));
	} catch (err) {
		res.statusCode = 500;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ ok: false, error: String(err) }));
	}
};



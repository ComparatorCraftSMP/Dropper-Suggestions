const { colors } = require("../../config.json");
const { editFeedMessage } = require("../../utils/actions");
const { serverLog } = require("../../utils/logs");
const { dbModify, dbQueryNoNew } = require("../../utils/db");
const { string } = require("../../utils/strings");
const { baseConfig, checkSuggestions } = require("../../utils/checks");
const { fetchUser, logEmbed } = require("../../utils/misc");
module.exports = {
	controls: {
		name: "deletecomment",
		permission: 3,
		aliases: ["delcomment", "dcomment", "rmcomment"],
		usage: "deletecomment <comment id>",
		description: "Deletes a comment on a suggestion",
		enabled: true,
		docs: "staff/deletecomment",
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "EMBED_LINKS", "USE_EXTERNAL_EMOJIS"],
		cooldown: 10
	},
	do: async (message, client, args, Discord) => {
		let [returned, qServerDB] = await baseConfig(message.guild.id);
		if (returned) return message.channel.send(returned);

		let suggestionsCheck = checkSuggestions(message.guild, qServerDB);
		if (suggestionsCheck) return message.channel.send(suggestionsCheck);

		if (!args[0]) return message.channel.send(string("NO_COMMENT_ID_SPECIFIED_ERROR", {}, "error"));
		let idsections = args[0].split("_");
		if (idsections.length < 2) return message.channel.send(string("NO_COMMENT_ID_SPECIFIED_ERROR", {}, "error"));
		let qSuggestionDB = await dbQueryNoNew("Suggestion", {suggestionId: idsections[0], id: message.guild.id});
		if (!qSuggestionDB) return message.channel.send(string("NO_COMMENT_ID_SPECIFIED_ERROR", {}, "error"));

		if (qSuggestionDB.implemented) return message.channel.send(string("SUGGESTION_IMPLEMENTED_ERROR", {}, "error"));

		let id = qSuggestionDB.suggestionId;

		let comment = qSuggestionDB.comments.find(comment => comment.id === idsections[1]) || null;
		if (!comment) return message.channel.send(string("NO_COMMENT_ID_SPECIFIED_ERROR", {}, "error"));
		if (comment.deleted) return message.channel.send(string("COMMENT_ALREADY_DELETED_ERROR", {}, "error"));

		comment.deleted = true;

		let editFeed = await editFeedMessage(qSuggestionDB, qServerDB, client);
		if (editFeed) return message.channel.send(editFeed);

		let author = await fetchUser(comment.author, client);
		if (!author) return message.channel.send(string("ERROR", {}, "error"));

		await dbModify("Suggestion", {suggestionId: id}, qSuggestionDB);

		let replyEmbed = new Discord.MessageEmbed()
			.setTitle(string("COMMENT_DELETED_TITLE"))
			.addField(author.id !== "0" ? string("COMMENT_TITLE", { user: author.tag, id: `${id}_${comment.id}` }) : string("COMMENT_TITLE_ANONYMOUS"), comment.comment)
			.setColor(colors.red)
			.setTimestamp();
		message.channel.send(replyEmbed);

		if (qServerDB.config.channels.log) {
			let logs = logEmbed(qSuggestionDB, message.author, "DELETED_COMMENT_LOG", "red")
				.addField(author.id !== "0" ? string("COMMENT_TITLE", { user: author.tag, id: `${id}_${comment.id}` }) : string("COMMENT_TITLE_ANONYMOUS"), comment.comment);

			serverLog(logs, qServerDB, client);
		}

		if (qServerDB.config.channels.log) {
			let logEmbed = new Discord.MessageEmbed()
				.setAuthor(string("DELETED_COMMENT_LOG", { user: message.author.tag, id: id, comment: `${id}_${comment.id}` }), message.author.displayAvatarURL({ format: "png", dynamic: true }))
				.addField(author.id !== "0" ? string("COMMENT_TITLE", { user: author.tag, id: `${id}_${comment.id}` }) : string("COMMENT_TITLE_ANONYMOUS"), comment.comment)
				.setFooter(string("LOG_SUGGESTION_SUBMITTED_FOOTER", { id: id, user: message.author.id }))
				.setTimestamp()
				.setColor(colors.red);
			serverLog(logEmbed, qServerDB, client);
		}
	}
};

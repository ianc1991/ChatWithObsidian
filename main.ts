import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

interface ChatWithObsidianSettings {
	mySetting: string;
	apiKey: string;
}

const DEFAULT_SETTINGS: ChatWithObsidianSettings = {
	mySetting: "default",
	apiKey: "",
};

export default class MyPlugin extends Plugin {
	settings: ChatWithObsidianSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("This is a notice!");
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new ChatModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new ChatModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async sendToChatGPT(prompt: string): Promise<string> {
		// Define the endpoint for the chat completion API
		const endpoint = "https://api.openai.com/v1/chat/completions";

		// Define the request body
		const requestBody = {
			model: "gpt-3.5-turbo",
			messages: [{ role: "user", content: prompt }],
			temperature: 0.7,
		};

		// Make the API request
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.settings.apiKey}`,
			},
			body: JSON.stringify(requestBody),
		});

		// Parse the response JSON
		const data = await response.json();

		// Extract the assistant's message content from the response
		const content = data.choices[0]?.message?.content || "";

		return content;
	}
}

class ChatModal extends Modal {
	private inputEl: HTMLInputElement;
	private conversationEl: HTMLDivElement;

	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;

		// Create a div element to display the conversation
		this.conversationEl = contentEl.createDiv();
		this.conversationEl.style.height = "200px";
		this.conversationEl.style.overflow = "auto";
		this.conversationEl.style.border = "1px solid #ccc";
		this.conversationEl.style.padding = "10px";
		this.conversationEl.style.marginBottom = "10px";

		// Create an input element to accept user input
		this.inputEl = contentEl.createEl("input");
		this.inputEl.type = "text";
		this.inputEl.placeholder = "Type your message...";

		// Create a button to send the message
		const sendButton = contentEl.createEl("button");
		sendButton.innerText = "Send";
		sendButton.addEventListener("click", () => this.sendMessage());
	}

	async sendMessage() {
		// Get the user's input
		const userInput = this.inputEl.value;

		// Append the user's message to the conversation
		this.conversationEl.innerHTML += `<div>User: ${userInput}</div>`;

		// Send the input to the ChatGPT API
		const chatGPTResponse = await (this.app as any).plugins.plugins[
			"chat-w-obsidian"
		].sendToChatGPT(userInput);

		// Append the ChatGPT response to the conversation
		this.conversationEl.innerHTML += `<div>ChatGPT: ${chatGPTResponse}</div>`;

		// Clear the input field
		this.inputEl.value = "";
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Enter your ChatGPT API key")
			.addText((text) =>
				text
					.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
			);
	}

	async readMarkdownFile(path: string) {
		// Get the file by its path
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			// Read the file's content
			const content = await this.app.vault.read(file);
			return content;
		}
		return null;
	}
}

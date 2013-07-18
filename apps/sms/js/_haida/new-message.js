var startupFunction = function() {
  ThreadUI.cleanFields(true);

  MessageManager.activity.recipients = null;

  //MessageManager.slide('left', function() {
    ThreadUI.initRecipients();

    if (MessageManager.activity.number ||
        MessageManager.activity.contact) {
      recipient = MessageManager.activity.contact || {
        number: MessageManager.activity.number,
        source: 'manual'
      };

      ThreadUI.recipients.add(recipient);

      MessageManager.activity.number = null;
      MessageManager.activity.contact = null;
    }

    // If the message has a body, use it to popuplate the input field.
    if (MessageManager.activity.body) {
      ThreadUI.setMessageBody(
        MessageManager.activity.body
      );
      MessageManager.activity.body = null;
    }
  //});
};

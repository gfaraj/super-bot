import Message from './Message'

export default class MessageBuilder {

  constructor(original) {
    this.original = original;
    this.message = new Message();

    if (original && original.addressee) {
      this.message.addressee = original.addressee
    }
  }

  text(s) {
    this.message.text = s;
    return this;
  }

  pipe(s) {
    this.message.text = `${(this.message.text || '')} | ${s}`; 
    return this;
  }

  attachment(a) {
    return this.attachments([a]);
  }

  attachments(a) {
    this.message.attachments = a;
    this.message.attachment = a && a[0];
    return this;
  }

  error(s) {
    this.message.error = true;
    this.text(s);
    return this;
  }

  raw(data) {
    Object.assign(this.message, data);
    return this;
  }

  addressee(value) {
    this.message.addressee = value;
    return this;
  }

  build() {
    return this.message;
  }
}
import template from './review-editor.html?raw';

interface ReviewEditorModel {
  productId?: string;
  onSubmit?: (review: { author: string; role: string; score: number; body: string }) => void;
  onCancel?: () => void;
}

export class ReviewEditor {
  public static readonly $au = {
    type: 'custom-element',
    name: 'review-editor',
    template,
  } as const;

  public productId: string = '';
  public author: string = '';
  public role: string = '';
  public score: number = 5;
  public body: string = '';
  public error: string = '';
  private onSubmitCallback: ((review: { author: string; role: string; score: number; body: string }) => void) | null = null;
  private onCancelCallback: (() => void) | null = null;

  public activate(model?: ReviewEditorModel): void {
    this.productId = model?.productId ?? '';
    this.onSubmitCallback = model?.onSubmit ?? null;
    this.onCancelCallback = model?.onCancel ?? null;
    this.author = '';
    this.role = '';
    this.score = 5;
    this.body = '';
    this.error = '';
  }

  public submit(): void {
    if (this.author.trim() === '' || this.body.trim() === '') {
      this.error = 'Add your name and a short note before posting.';
      return;
    }

    this.error = '';
    this.onSubmitCallback?.({
      author: this.author.trim(),
      role: this.role.trim() === '' ? 'Verified buyer' : this.role.trim(),
      score: this.score,
      body: this.body.trim(),
    });
  }

  public cancel(): void {
    this.onCancelCallback?.();
  }
}

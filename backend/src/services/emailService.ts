import transporter from '../config/email';
import { renderTemplate } from './emailTemplateService';

export class EmailService {
  private fromEmail = process.env.SMTP_USER || 'noreply@guincoin.com';
  private fromName = 'Guincoin Rewards';
  private frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  /**
   * Send email notification
   */
  private async sendEmail(to: string, subject: string, html: string) {
    try {
      await transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't throw - email failures shouldn't break the application
    }
  }

  /**
   * Send notification for manager award
   */
  async sendManagerAwardNotification(
    recipientEmail: string,
    recipientName: string,
    managerName: string,
    amount: number,
    message?: string
  ) {
    const messageBlock = message
      ? `<p style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">"${message}"</p>`
      : '';

    const rendered = await renderTemplate('manager_award_received', {
      recipientName,
      managerName,
      amount,
      message,
      messageBlock,
    });

    if (!rendered) return;
    await this.sendEmail(recipientEmail, rendered.subject, rendered.html);
  }

  /**
   * Send confirmation for manager award to manager
   */
  async sendManagerAwardSentNotification(
    managerEmail: string,
    managerName: string,
    recipientName: string,
    amount: number,
    message?: string
  ) {
    const messageBlock = message
      ? `<p style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">"${message}"</p>`
      : '';

    const rendered = await renderTemplate('manager_award_sent', {
      managerName,
      recipientName,
      amount,
      message,
      messageBlock,
    });

    if (!rendered) return;
    await this.sendEmail(managerEmail, rendered.subject, rendered.html);
  }

  /**
   * Send notification for peer transfer
   */
  async sendPeerTransferNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    amount: number,
    message?: string
  ) {
    const messageBlock = message
      ? `<p style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">"${message}"</p>`
      : '';

    const rendered = await renderTemplate('peer_transfer_received', {
      recipientName,
      senderName,
      amount,
      message,
      messageBlock,
    });

    if (!rendered) return;
    await this.sendEmail(recipientEmail, rendered.subject, rendered.html);
  }

  /**
   * Send confirmation for peer transfer to sender
   */
  async sendPeerTransferSentNotification(
    senderEmail: string,
    senderName: string,
    recipientName: string,
    amount: number,
    message?: string
  ) {
    const messageBlock = message
      ? `<p style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">"${message}"</p>`
      : '';

    const rendered = await renderTemplate('peer_transfer_sent', {
      senderName,
      recipientName,
      amount,
      message,
      messageBlock,
    });

    if (!rendered) return;
    await this.sendEmail(senderEmail, rendered.subject, rendered.html);
  }

  /**
   * Send notification when recipient is not found
   */
  async sendPeerTransferRecipientNotFoundNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    amount: number,
    message?: string
  ) {
    const messageBlock = message
      ? `<p style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">"${message}"</p>`
      : '';

    const rendered = await renderTemplate('peer_transfer_recipient_not_found', {
      recipientName,
      recipientEmail,
      senderName,
      amount,
      message,
      messageBlock,
      signinUrl: `${this.frontendUrl}/login`,
    });

    if (!rendered) return;
    await this.sendEmail(recipientEmail, rendered.subject, rendered.html);
  }

  /**
   * Send notification for wellness approval
   */
  async sendWellnessApprovalNotification(
    employeeEmail: string,
    employeeName: string,
    taskName: string,
    amount: number
  ) {
    const rendered = await renderTemplate('wellness_approved', {
      employeeName,
      taskName,
      amount,
    });

    if (!rendered) return;
    await this.sendEmail(employeeEmail, rendered.subject, rendered.html);
  }

  /**
   * Send notification for wellness rejection
   */
  async sendWellnessRejectionNotification(
    employeeEmail: string,
    employeeName: string,
    taskName: string,
    reason?: string
  ) {
    const reasonBlock = reason
      ? `<p style="background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0;"><strong>Reason:</strong> ${reason}</p>`
      : '';

    const rendered = await renderTemplate('wellness_rejected', {
      employeeName,
      taskName,
      reason,
      reasonBlock,
    });

    if (!rendered) return;
    await this.sendEmail(employeeEmail, rendered.subject, rendered.html);
  }

  /**
   * Send notification for purchase fulfillment
   */
  async sendPurchaseFulfilledNotification(
    employeeEmail: string,
    employeeName: string,
    productName: string,
    trackingNumber?: string
  ) {
    const trackingBlock = trackingNumber
      ? `<p style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>`
      : '';

    const rendered = await renderTemplate('purchase_fulfilled', {
      employeeName,
      productName,
      trackingNumber,
      trackingBlock,
    });

    if (!rendered) return;
    await this.sendEmail(employeeEmail, rendered.subject, rendered.html);
  }
  /**
   * Send notification when a role is assigned to an employee
   */
  async sendRoleAssignedNotification(
    employeeEmail: string,
    employeeName: string,
    role: string,
    _isManager?: boolean,
    _isAdmin?: boolean
  ) {
    const rendered = await renderTemplate('role_assigned', {
      employeeName,
      role,
    });

    if (!rendered) return;
    await this.sendEmail(employeeEmail, rendered.subject, rendered.html);
  }

  /**
   * Send notification when allotment deposit is made
   */
  async sendAllotmentDepositNotification(
    managerEmail: string,
    managerName: string,
    amount: number,
    _newBalance?: number
  ) {
    const rendered = await renderTemplate('allotment_deposit', {
      managerName,
      amount,
    });

    if (!rendered) return;
    await this.sendEmail(managerEmail, rendered.subject, rendered.html);
  }
}

export default new EmailService();

const socketEvents = {};

socketEvents.NewUser = 'NewUser'
socketEvents.LogOut= 'LogOut'
socketEvents.NewSignup = 'NewSignup'
socketEvents.RemovePromoCode = 'RemovePromoCode'
socketEvents.Company = 'Company'
socketEvents.NewMessage = 'NewMessage'
socketEvents.NotificationsCount = 'NotificationsCount'
socketEvents.NotRatedTrips = 'NotRatedTrips'
socketEvents.NewLocation = 'NewLocation'
socketEvents.HelpCount = 'HelpCount'
socketEvents.Typing = 'Typing'
socketEvents.StopTyping = 'StopTyping'
socketEvents.UpdateLocation = 'UpdateLocation'
socketEvents.ChangeOrderStatus = 'ChangeOrderStatus'
socketEvents.NewMessageCount = 'NewMessageCount';
socketEvents.UpdateSeen = 'UpdateSeen';
socketEvents.UpdateOrderCount = 'UpdateOrderCount';
socketEvents.ContactUsCount = 'ContactUsCount';
socketEvents.IssueCount = 'IssueCount';
socketEvents.WaitingAdvCount = 'WaitingAdvCount';
socketEvents.ChangeAdvertismentStatus = 'ChangeAdvertismentStatus';
socketEvents.OrderExpired = 'OrderExpired';

socketEvents.WaitingDriverCount = 'WaitingDriverCount';
socketEvents.WaitingInstitutionCount = 'WaitingInstitutionCount';

////////////////////////////////////////////////////////
socketEvents.NewOrder = 'NewOrder';
socketEvents.ChangeOrderStatus = 'ChangeOrderStatus';
socketEvents.NewOrdersCount = 'NewOrdersCount';
socketEvents.CurrentOrderCount = 'CurrentOrderCount';
socketEvents.FinishedOrderCount = 'FinishedOrderCount';
socketEvents.TraderNotResponseCount = 'TraderNotResponseCount';
export default socketEvents;
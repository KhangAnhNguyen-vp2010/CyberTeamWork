import 'package:flutter/material.dart';

class CustomToast extends StatelessWidget {
  final String message;
  final bool isError;
  final IconData icon;

  const CustomToast({
    Key? key,
    required this.message,
    this.isError = false,
    this.icon = Icons.info,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(25.0),
        color: isError ? Colors.red[700] : Colors.green[700],
        boxShadow: [
          BoxShadow(
            color: Colors.black26,
            offset: Offset(0, 4),
            blurRadius: 10,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white),
          SizedBox(width: 12.0),
          Flexible(
            child: Text(
              message,
              style: TextStyle(
                color: Colors.white,
                fontSize: 14.0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static void show(
    BuildContext context, {
    required String message,
    bool isError = false,
    IconData icon = Icons.info,
  }) {
    final overlay = Overlay.of(context);
    final overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        top: MediaQuery.of(context).padding.top + 20,
        left: 20,
        right: 20,
        child: Material(
          color: Colors.transparent,
          child: CustomToast(
            message: message,
            isError: isError,
            icon: icon,
          ),
        ),
      ),
    );

    overlay.insert(overlayEntry);

    Future.delayed(Duration(seconds: 3), () {
      overlayEntry.remove();
    });
  }
}
